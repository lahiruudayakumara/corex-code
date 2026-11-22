import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { AgentSession } from "../agent/session";
import { errorMessage } from "../errors";
import { matchesModelName, OllamaModelManager, type LocalModel, type PullProgress } from "../models/manager";
import { OllamaAdapter } from "../models/ollama";
import { gitDiff, gitStatus } from "../repository/git";
import type { RepositoryTools } from "../repository/tools";
import type { AgentEvent, AgentMode, ApprovalRequest, ModelUsage } from "../types";
import { renderBanner } from "../ui/banner";
import { cycleMode, modeLabel, moveSelection, UI_COMMANDS, visibleTail } from "./state";
import { TextArea } from "./text-area";

type CorexTuiProps = {
  root: string;
  initialModel: string;
  host: string;
  keepAlive: string;
  maxSteps: number;
  repository: RepositoryTools;
  modelManager: OllamaModelManager;
};

type TranscriptMessage = {
  id: number;
  role: "user" | "assistant" | "system" | "error";
  content: string;
};

type PendingApproval = {
  request: ApprovalRequest;
  resolve(approved: boolean): void;
};

type Overlay = "commands" | "models" | null;
type ModelAction = "list" | "custom" | "downloading";

export function CorexTui({
  root,
  initialModel,
  host,
  keepAlive,
  maxSteps,
  repository,
  modelManager,
}: CorexTuiProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [activity, setActivity] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AgentMode>("build");
  const [model, setModel] = useState(initialModel);
  const [modelReady, setModelReady] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selection, setSelection] = useState(0);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelAction, setModelAction] = useState<ModelAction>("list");
  const [modelDraft, setModelDraft] = useState("");
  const [modelProgress, setModelProgress] = useState<PullProgress | null>(null);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [usage, setUsage] = useState<ModelUsage | null>(null);
  const id = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const session = useRef<AgentSession | null>(null);

  const addMessage = useCallback((role: TranscriptMessage["role"], content: string) => {
    id.current += 1;
    setMessages((current) => [...current, { id: id.current, role, content }]);
  }, []);

  const onAgentEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "tool_start":
        setActivity(`Running ${event.tool}${event.summary ? ` · ${event.summary}` : ""}`);
        break;
      case "tool_result":
        setActivity(`${event.tool} complete`);
        break;
      case "approval":
        setActivity(event.approved ? `Applied ${event.path}` : `Rejected ${event.path}`);
        break;
      case "usage":
        setUsage(event.usage);
        break;
      case "warning":
        addMessage("system", `Warning: ${event.message}`);
    }
  }, [addMessage]);

  const createSession = useCallback(
    (modelName: string) =>
      new AgentSession({
        model: new OllamaAdapter(modelName, host, keepAlive),
        repository,
        maxSteps,
        approve: (request) =>
          new Promise<boolean>((resolve) => {
            setApproval({ request, resolve });
            setActivity(`Approval required · ${request.path}`);
          }),
        onEvent: onAgentEvent,
      }),
    [host, keepAlive, maxSteps, onAgentEvent, repository],
  );

  if (!session.current) session.current = createSession(initialModel);

  useEffect(() => {
    let active = true;
    void modelManager
      .list()
      .then((available) => {
        if (!active) return;
        setModels(available);
        const installed = available.find((item) => matchesModelName(item.name, initialModel));
        if (installed) {
          setModel(installed.name);
          setModelReady(true);
          if (installed.name !== initialModel) session.current = createSession(installed.name);
          setActivity("Ready");
        } else {
          setModelReady(false);
          setActivity(`Model not installed · use /model`);
          addMessage("system", `Model '${initialModel}' is not installed. Type /model to select or download one.`);
        }
      })
      .catch((error) => {
        if (!active) return;
        setModelReady(false);
        setActivity("Ollama unavailable");
        addMessage("error", errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [addMessage, createSession, initialModel, modelManager]);

  const openModels = useCallback(async () => {
    setOverlay("models");
    setSelection(0);
    setModelAction("list");
    setModelDraft("");
    setModelProgress(null);
    setModelsLoading(true);
    try {
      setModels(await modelManager.list());
    } catch (error) {
      setOverlay(null);
      addMessage("error", errorMessage(error));
    } finally {
      setModelsLoading(false);
    }
  }, [addMessage, modelManager]);

  const downloadModel = useCallback(
    async (name: string) => {
      const downloadController = new AbortController();
      controller.current = downloadController;
      setModelAction("downloading");
      setModelProgress(null);
      setActivity(`Downloading ${name}`);
      try {
        await modelManager.pull(name, setModelProgress, downloadController.signal);
        const available = await modelManager.list();
        setModels(available);
        setModel(name);
        setModelReady(true);
        session.current = createSession(name);
        setMessages([]);
        setOverlay(null);
        setActivity(`Downloaded and selected ${name}`);
      } catch (error) {
        setOverlay(null);
        setModelAction("list");
        setActivity("Model download failed");
        addMessage("error", errorMessage(error));
      } finally {
        controller.current = null;
      }
    },
    [addMessage, createSession, modelManager],
  );

  const runCommand = useCallback(
    async (command: string): Promise<boolean> => {
      switch (command.trim().toLowerCase()) {
        case "/help":
          addMessage(
            "system",
            [
              "Commands",
              ...UI_COMMANDS.map((item) => `${item.name.padEnd(9)} ${item.description}`),
              "",
              "Keys: Enter submit · Shift+Enter newline · Shift+Tab mode · Ctrl+P commands · Ctrl+O models · Ctrl+C cancel/exit",
            ].join("\n"),
          );
          return true;
        case "/status":
          addMessage("system", await gitStatus(root));
          return true;
        case "/diff":
          addMessage("system", await gitDiff(root));
          return true;
        case "/model":
          await openModels();
          return true;
        case "/clear":
          setMessages([]);
          setActivity("Conversation cleared");
          return true;
        case "/new":
          session.current = createSession(model);
          setMessages([]);
          setStreaming("");
          setActivity("New session");
          return true;
        case "/exit":
        case "/quit":
          exit();
          return true;
        default:
          return false;
      }
    },
    [addMessage, createSession, exit, model, openModels, root],
  );

  const submit = useCallback(
    async (raw: string) => {
      const prompt = raw.trim();
      if (!prompt || busy) return;
      setInput("");
      setHistory((current) => [...current.filter((item) => item !== prompt), prompt].slice(-50));
      setHistoryIndex(0);
      if (prompt.startsWith("/")) {
        try {
          if (!(await runCommand(prompt))) addMessage("error", `Unknown command: ${prompt}`);
        } catch (error) {
          addMessage("error", errorMessage(error));
        }
        return;
      }
      if (!modelReady) {
        addMessage("error", "No usable model is selected. Type /model to select or download one.");
        return;
      }

      addMessage("user", prompt);
      setStreaming("");
      setBusy(true);
      setActivity("Thinking");
      const turnController = new AbortController();
      controller.current = turnController;
      try {
        const result = await session.current!.run(
          prompt,
          turnController.signal,
          (token) => setStreaming((current) => current + token),
          mode,
        );
        if (result.response) addMessage("assistant", result.response);
        setActivity(result.changedFiles.length ? `Changed ${result.changedFiles.join(", ")}` : "Ready");
      } catch (error) {
        addMessage("error", errorMessage(error));
        setActivity("Turn failed");
      } finally {
        controller.current = null;
        setStreaming("");
        setBusy(false);
      }
    },
    [addMessage, busy, mode, modelReady, runCommand],
  );

  const selectHistory = useCallback(
    (direction: -1 | 1) => {
      if (!history.length) return;
      const next = Math.min(history.length, Math.max(0, historyIndex - direction));
      setHistoryIndex(next);
      setInput(next === 0 ? "" : history[history.length - next] ?? "");
    },
    [history, historyIndex],
  );

  useInput((keyInput, key) => {
    if (approval) {
      if (keyInput.toLowerCase() === "y") {
        approval.resolve(true);
        setApproval(null);
      } else if (keyInput.toLowerCase() === "n" || key.escape) {
        approval.resolve(false);
        setApproval(null);
      }
      return;
    }

    if (overlay) {
      if (overlay === "models" && modelAction === "custom") {
        if (key.escape) {
          setModelAction("list");
          setModelDraft("");
        } else if (key.return && modelDraft.trim()) {
          void downloadModel(modelDraft.trim());
        } else if (key.backspace || key.delete) {
          setModelDraft((current) => current.slice(0, -1));
        } else if (!key.ctrl && !key.tab && keyInput) {
          setModelDraft((current) => `${current}${keyInput}`.slice(0, 200));
        }
        return;
      }
      if (overlay === "models" && modelAction === "downloading") {
        if (key.ctrl && keyInput === "c") controller.current?.abort();
        return;
      }
      const length = overlay === "commands" ? UI_COMMANDS.length : models.length + 2;
      if (key.escape) {
        setOverlay(null);
      } else if (key.upArrow) {
        setSelection((current) => moveSelection(current, -1, length));
      } else if (key.downArrow) {
        setSelection((current) => moveSelection(current, 1, length));
      } else if (key.return) {
        if (overlay === "commands") {
          const command = UI_COMMANDS[selection]?.name;
          setOverlay(null);
          if (command) void runCommand(command);
        } else {
          const selected = models[selection];
          if (selection < models.length && selected) {
            setModel(selected.name);
            setModelReady(true);
            session.current = createSession(selected.name);
            setOverlay(null);
            setMessages([]);
            setActivity(`Switched to ${selected.name}`);
          } else if (selection === models.length) {
            void downloadModel(initialModel);
          } else {
            setModelAction("custom");
            setModelDraft("");
          }
        }
      }
      return;
    }

    if (key.ctrl && keyInput === "p") {
      setSelection(0);
      setOverlay("commands");
      return;
    }
    if (key.ctrl && keyInput === "o") {
      void openModels();
      return;
    }
    if (key.ctrl && keyInput === "l") {
      setMessages([]);
      return;
    }
    if (key.tab && key.shift && !busy) {
      setMode((current) => cycleMode(current));
      return;
    }
    if (key.ctrl && keyInput === "c") {
      if (busy) {
        controller.current?.abort();
        setActivity("Cancelling turn");
      } else {
        exit();
      }
    }
  });

  const rows = process.stdout.rows ?? 24;
  const columns = process.stdout.columns ?? 80;
  const messageLimit = Math.max(4, Math.floor((rows - 14) / 3));
  const visibleMessages = visibleTail(messages, messageLimit);
  const composerActive = !busy && !overlay && !approval;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
        <Text bold color="cyan">COREX CODE</Text>
        <Text bold>+ New session</Text>
        {columns >= 90 ? <Text dimColor>{root}</Text> : null}
      </Box>

      {messages.length === 0 && !streaming ? (
        <Box flexDirection="column" alignItems="center" paddingY={1}>
          <Text color="cyan">{columns >= 70 ? renderBanner("0.1.0") : "COREX CODE · v0.1.0"}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" minHeight={3} marginY={1}>
        {visibleMessages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        {streaming ? (
          <Box marginBottom={1}>
            <Text color="green" bold>corex › </Text>
            <Text>{streaming}</Text>
          </Box>
        ) : null}
        {busy && !streaming ? <Text color="yellow">● {activity}…</Text> : null}
      </Box>

      {approval ? (
        <ApprovalPanel approval={approval.request} />
      ) : overlay === "commands" ? (
        <CommandPalette selection={selection} />
      ) : overlay === "models" ? (
        <ModelPalette
          models={models}
          selection={selection}
          loading={modelsLoading}
          action={modelAction}
          configuredModel={initialModel}
          draft={modelDraft}
          progress={modelProgress}
        />
      ) : (
        <Box borderStyle="round" borderColor={busy ? "yellow" : "cyan"} flexDirection="column" paddingX={1}>
          <Box minHeight={2}>
            <Text color="cyan" bold>› </Text>
            <TextArea
              value={input}
              onChange={setInput}
              onSubmit={(value) => void submit(value)}
              onHistory={selectHistory}
              placeholder={
                busy
                  ? "Corex is working…"
                  : modelReady
                    ? "Ask anything…  e.g. Fix broken tests"
                    : "Type /model to select or download a model"
              }
              isActive={composerActive}
              disabled={busy}
            />
          </Box>
          <Box justifyContent="space-between">
            <Text>
              <Text color={mode === "build" ? "blue" : mode === "plan" ? "yellow" : "magenta"} bold>
                {modeLabel(mode)}
              </Text>
              <Text dimColor> · </Text>
              <Text bold color={modelReady ? "white" : "red"}>{model}{modelReady ? "" : " (not installed)"}</Text>
              <Text dimColor> · Ollama</Text>
            </Text>
            <Text dimColor>{usageText(usage)}</Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>{activity}</Text>
        <Box justifyContent="flex-end">
          <Text>
            <Text bold>shift+tab</Text><Text dimColor> mode  </Text>
            <Text bold>ctrl+p</Text><Text dimColor> commands  </Text>
            <Text bold>/model</Text><Text dimColor> models</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function Message({ message }: { message: TranscriptMessage }) {
  const style =
    message.role === "user"
      ? { label: "you", color: "cyan" }
      : message.role === "assistant"
        ? { label: "corex", color: "green" }
        : message.role === "error"
          ? { label: "error", color: "red" }
          : { label: "info", color: "yellow" };
  return (
    <Box marginBottom={1}>
      <Text bold color={style.color}>{style.label} › </Text>
      <Text>{message.content}</Text>
    </Box>
  );
}

function CommandPalette({ selection }: { selection: number }) {
  return (
    <Box borderStyle="round" borderColor="blue" flexDirection="column" paddingX={1}>
      <Text bold color="blue">Commands</Text>
      {UI_COMMANDS.map((command, index) => (
        <Text key={command.name} inverse={index === selection}>
          {index === selection ? "›" : " "} {command.name.padEnd(9)} {command.description}
        </Text>
      ))}
      <Text dimColor>↑↓ navigate · enter select · esc close</Text>
    </Box>
  );
}

function ModelPalette({
  models,
  selection,
  loading,
  action,
  configuredModel,
  draft,
  progress,
}: {
  models: LocalModel[];
  selection: number;
  loading: boolean;
  action: ModelAction;
  configuredModel: string;
  draft: string;
  progress: PullProgress | null;
}) {
  if (action === "custom") {
    return (
      <Box borderStyle="round" borderColor="magenta" flexDirection="column" paddingX={1}>
        <Text bold color="magenta">Download another model</Text>
        <Text>Model name: {draft}<Text inverse> </Text></Text>
        <Text dimColor>enter download · esc back</Text>
      </Box>
    );
  }
  if (action === "downloading") {
    return (
      <Box borderStyle="round" borderColor="yellow" flexDirection="column" paddingX={1}>
        <Text bold color="yellow">Downloading model</Text>
        <Text>{progress?.status ?? "Starting download…"}</Text>
        {progress?.percent === undefined ? null : <Text color="cyan">{progress.percent}%</Text>}
        <Text dimColor>ctrl+c cancel</Text>
      </Box>
    );
  }
  return (
    <Box borderStyle="round" borderColor="magenta" flexDirection="column" paddingX={1}>
      <Text bold color="magenta">Select or download model</Text>
      {loading ? <Text>Loading…</Text> : null}
      {!loading && !models.length ? <Text dimColor>No installed models found</Text> : null}
      {models.map((item, index) => (
        <Text key={item.name} inverse={index === selection}>
          {index === selection ? "›" : " "} {item.name} {item.parameterSize ?? ""} {item.quantization ?? ""}
        </Text>
      ))}
      {!loading ? (
        <>
          <Text inverse={selection === models.length}>
            {selection === models.length ? "›" : " "} Download configured: {configuredModel}
          </Text>
          <Text inverse={selection === models.length + 1}>
            {selection === models.length + 1 ? "›" : " "} Download another model…
          </Text>
        </>
      ) : null}
      <Text dimColor>↑↓ navigate · enter select · esc close</Text>
    </Box>
  );
}

function ApprovalPanel({ approval }: { approval: ApprovalRequest }) {
  const diff = approval.diff.split("\n").slice(-18).join("\n");
  return (
    <Box borderStyle="double" borderColor="yellow" flexDirection="column" paddingX={1}>
      <Text bold color="yellow">Approval required · {approval.path}</Text>
      <Text>{approval.explanation}</Text>
      <Text>{diff}</Text>
      <Text><Text bold color="green">Y</Text> apply exact patch · <Text bold color="red">N</Text> reject</Text>
    </Box>
  );
}

function usageText(usage: ModelUsage | null): string {
  if (!usage) return "";
  const input = usage.promptTokens === undefined ? "" : `${usage.promptTokens} in`;
  const output = usage.generatedTokens === undefined ? "" : `${usage.generatedTokens} out`;
  return [input, output].filter(Boolean).join(" · ");
}
