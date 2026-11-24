import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Text,
  useApp,
  useBoxMetrics,
  useInput,
  useWindowSize,
  type DOMElement,
} from "ink";
import { AgentSession } from "../agent/session";
import { errorMessage } from "../errors";
import {
  matchesModelName,
  OllamaModelManager,
  type LocalModel,
  type PullProgress,
} from "../models/manager";
import { OllamaAdapter } from "../models/ollama";
import { gitDiff, gitStatus } from "../repository/git";
import type { RepositoryTools } from "../repository/tools";
import type {
  AgentEvent,
  AgentMode,
  ApprovalRequest,
  ModelUsage,
} from "../types";
import { renderBanner } from "../ui/banner";
import { cycleMode, modeLabel, moveSelection, UI_COMMANDS } from "./state";
import {
  parseMarkdownBlocks,
  tokenizeCodeLine,
  type CodeToken,
} from "./markdown";
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
  const [scrollFromBottom, setScrollFromBottom] = useState(0);
  const id = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const session = useRef<AgentSession | null>(null);
  const viewportRef = useRef<DOMElement | null>(null);
  const contentRef = useRef<DOMElement | null>(null);
  const viewport = useBoxMetrics(viewportRef);
  const content = useBoxMetrics(contentRef);
  const { rows, columns } = useWindowSize();
  const maxScroll = Math.max(0, content.height - viewport.clientHeight);
  const scrollTop = Math.max(0, maxScroll - Math.min(scrollFromBottom, maxScroll));
  const maxScrollRef = useRef(maxScroll);
  const pageSizeRef = useRef(Math.max(1, viewport.clientHeight - 1));
  maxScrollRef.current = maxScroll;
  pageSizeRef.current = Math.max(1, viewport.clientHeight - 1);

  useEffect(() => {
    const handleMouse = (chunk: Buffer | string) => {
      const input = chunk.toString();
      for (const sequence of input.split("\u001b[<").slice(1)) {
        const match = sequence.match(/^(\d+);\d+;\d+[Mm]/);
        if (!match) continue;
        const button = Number(match[1]);
        if ((button & 64) === 0) continue;
        const direction = (button & 1) === 0 ? 1 : -1;
        setScrollFromBottom((current) =>
          Math.max(
            0,
            Math.min(
              maxScrollRef.current,
              current + direction * Math.max(3, Math.floor(pageSizeRef.current / 3)),
            ),
          ),
        );
      }
    };

    process.stdout.write("\u001b[?1000h\u001b[?1006h");
    process.stdin.on("data", handleMouse);
    return () => {
      process.stdin.off("data", handleMouse);
      process.stdout.write("\u001b[?1006l\u001b[?1000l");
    };
  }, []);

  const addMessage = useCallback(
    (role: TranscriptMessage["role"], content: string) => {
      id.current += 1;
      setMessages((current) => [...current, { id: id.current, role, content }]);
      setScrollFromBottom(0);
    },
    [],
  );

  const onAgentEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case "tool_start":
          setActivity(
            `Running ${event.tool}${event.summary ? ` · ${event.summary}` : ""}`,
          );
          break;
        case "tool_result":
          setActivity(`${event.tool} complete`);
          break;
        case "approval":
          setActivity(
            event.approved ? `Applied ${event.path}` : `Rejected ${event.path}`,
          );
          break;
        case "usage":
          setUsage(event.usage);
          break;
        case "warning":
          addMessage("system", `Warning: ${event.message}`);
      }
    },
    [addMessage],
  );

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
        const installed = available.find((item) =>
          matchesModelName(item.name, initialModel),
        );
        if (installed) {
          setModel(installed.name);
          setModelReady(true);
          if (installed.name !== initialModel)
            session.current = createSession(installed.name);
          setActivity("Ready");
        } else {
          setModelReady(false);
          setActivity(`Model not installed · use /model`);
          addMessage(
            "system",
            `Model '${initialModel}' is not installed. Type /model to select or download one.`,
          );
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
        await modelManager.pull(
          name,
          setModelProgress,
          downloadController.signal,
        );
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
              ...UI_COMMANDS.map(
                (item) => `${item.name.padEnd(9)} ${item.description}`,
              ),
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
      setHistory((current) =>
        [...current.filter((item) => item !== prompt), prompt].slice(-50),
      );
      setHistoryIndex(0);
      if (prompt.startsWith("/")) {
        try {
          if (!(await runCommand(prompt)))
            addMessage("error", `Unknown command: ${prompt}`);
        } catch (error) {
          addMessage("error", errorMessage(error));
        }
        return;
      }
      if (!modelReady) {
        addMessage(
          "error",
          "No usable model is selected. Type /model to select or download one.",
        );
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
          (token) => {
            setScrollFromBottom(0);
            setStreaming((current) => current + token);
          },
          mode,
        );
        if (result.response) addMessage("assistant", result.response);
        setActivity(
          result.changedFiles.length
            ? `Changed ${result.changedFiles.join(", ")}`
            : "Ready",
        );
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
      const next = Math.min(
        history.length,
        Math.max(0, historyIndex - direction),
      );
      setHistoryIndex(next);
      setInput(next === 0 ? "" : (history[history.length - next] ?? ""));
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
      const length =
        overlay === "commands" ? UI_COMMANDS.length : models.length + 2;
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
    if (key.pageUp || (key.ctrl && key.upArrow)) {
      const page = Math.max(1, viewport.clientHeight - 1);
      setScrollFromBottom((current) => Math.min(maxScroll, current + page));
      return;
    }
    if (key.pageDown || (key.ctrl && key.downArrow)) {
      const page = Math.max(1, viewport.clientHeight - 1);
      setScrollFromBottom((current) => Math.max(0, current - page));
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

  const composerActive = !busy && !overlay && !approval;

  return (
    <Box flexDirection="column" paddingX={1} height={rows} overflow="hidden">
      <Box flexDirection="column" alignItems="center" flexShrink={0}>
        <Text color="cyan">
          {columns >= 70 ? renderBanner("0.1.0") : "COREX CODE · v0.1.0"}
        </Text>
      </Box>

      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        justifyContent="space-between"
        flexShrink={0}
      >
        <Text bold>+ New session</Text>
      </Box>

      <Box
        ref={viewportRef}
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        overflow="hidden"
        contentOffsetY={scrollTop}
      >
        <Box
          ref={contentRef}
          flexDirection="column"
          flexShrink={0}
          paddingY={1}
        >
          {messages.length > 0 || streaming ? (
            <>
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {streaming ? (
                <Box marginBottom={1}>
                  <Text color="green" bold>
                    corex ›{" "}
                  </Text>
                  <Text>{streaming}</Text>
                </Box>
              ) : null}
              {busy && !streaming ? (
                <Text color="yellow">● {activity}…</Text>
              ) : null}
            </>
          ) : null}
        </Box>
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
        <Box
          borderStyle="round"
          borderColor={busy ? "yellow" : "cyan"}
          flexDirection="column"
          flexShrink={0}
          paddingX={1}
        >
          <Box minHeight={2}>
            <Text color="cyan" bold>
              ›{" "}
            </Text>
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
              <Text
                color={
                  mode === "build"
                    ? "blue"
                    : mode === "plan"
                      ? "yellow"
                      : "magenta"
                }
                bold
              >
                {modeLabel(mode)}
              </Text>
              <Text dimColor> · </Text>
              <Text bold color={modelReady ? "white" : "red"}>
                {model}
                {modelReady ? "" : " (not installed)"}
              </Text>
              <Text dimColor> · Ollama</Text>
            </Text>
            <Text dimColor>{usageText(usage)}</Text>
          </Box>
        </Box>
      )}

      <Box
        flexDirection="row"
        justifyContent="space-between"
        width="100%"
        flexShrink={0}
      >
        {/* Left: Two lines */}
        <Box flexDirection="column" flexShrink={1}>
          <Text dimColor>{activity}</Text>

          {columns >= 90 && <Text dimColor>{root}</Text>}
        </Box>

        {/* Right: Shortcuts */}
        <Box alignItems="flex-end">
          <Text>
            <Text bold>shift+tab</Text>
            <Text dimColor> mode </Text>
            <Text bold>ctrl+p</Text>
            <Text dimColor> commands </Text>
            <Text bold>/model</Text>
            <Text dimColor> models </Text>
            <Text bold>pgup/dn</Text>
            <Text dimColor> scroll</Text>
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
      <Text bold color={style.color}>
        {style.label} ›{" "}
      </Text>
      <RichText content={message.content} />
    </Box>
  );
}

function RichText({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);
  return (
    <Box flexDirection="column" flexGrow={1}>
      {blocks.map((block, index) =>
        block.type === "code" ? (
          <Box
            key={index}
            borderStyle="single"
            borderColor="gray"
            flexDirection="column"
            paddingX={1}
            marginY={1}
          >
            {block.language ? (
              <Text color="yellow" dimColor>
                {block.language}
              </Text>
            ) : null}
            {block.content.split("\n").map((line, lineIndex) => (
              <Text key={lineIndex}>
                {tokenizeCodeLine(line).map((token, tokenIndex) => (
                  <Code key={tokenIndex} token={token} />
                ))}
              </Text>
            ))}
          </Box>
        ) : (
          <Box key={index} flexDirection="column">
            {block.content.split("\n").map((line, lineIndex) => (
              <MarkdownLine key={lineIndex} line={line} />
            ))}
          </Box>
        ),
      )}
    </Box>
  );
}

function MarkdownLine({ line }: { line: string }) {
  if (line.startsWith("### "))
    return (
      <Text bold color="cyan">
        {line.slice(4)}
      </Text>
    );
  if (line.startsWith("## "))
    return (
      <Text bold color="cyan">
        {line.slice(3)}
      </Text>
    );
  if (line.startsWith("# "))
    return (
      <Text bold color="cyan">
        {line.slice(2)}
      </Text>
    );
  const bullet = line.match(/^\s*[-*]\s+(.+)$/);
  if (bullet)
    return (
      <Text>
        <Text color="cyan">• </Text>
        <InlineText content={bullet[1]!} />
      </Text>
    );
  if (line.startsWith("+")) return <Text color="green">{line}</Text>;
  if (line.startsWith("-") && !line.startsWith("---"))
    return <Text color="red">{line}</Text>;
  return <InlineText content={line} />;
}

function InlineText({ content }: { content: string }) {
  const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Text key={index} color="cyan">
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={index} bold>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function Code({ token }: { token: CodeToken }) {
  const color =
    token.kind === "keyword"
      ? "magenta"
      : token.kind === "string"
        ? "green"
        : token.kind === "number"
          ? "cyan"
          : token.kind === "comment"
            ? "gray"
            : "white";
  return (
    <Text color={color} dimColor={token.kind === "comment"}>
      {token.text}
    </Text>
  );
}

function CommandPalette({ selection }: { selection: number }) {
  return (
    <Box
      borderStyle="round"
      borderColor="blue"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="blue">
        Commands
      </Text>
      {UI_COMMANDS.map((command, index) => (
        <Text key={command.name} inverse={index === selection}>
          {index === selection ? "›" : " "} {command.name.padEnd(9)}{" "}
          {command.description}
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
      <Box
        borderStyle="round"
        borderColor="magenta"
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="magenta">
          Download another model
        </Text>
        <Text>
          Model name: {draft}
          <Text inverse> </Text>
        </Text>
        <Text dimColor>enter download · esc back</Text>
      </Box>
    );
  }
  if (action === "downloading") {
    return (
      <Box
        borderStyle="round"
        borderColor="yellow"
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="yellow">
          Downloading model
        </Text>
        <Text>{progress?.status ?? "Starting download…"}</Text>
        {progress?.percent === undefined ? null : (
          <Text color="cyan">{progress.percent}%</Text>
        )}
        <Text dimColor>ctrl+c cancel</Text>
      </Box>
    );
  }
  return (
    <Box
      borderStyle="round"
      borderColor="magenta"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="magenta">
        Select or download model
      </Text>
      {loading ? <Text>Loading…</Text> : null}
      {!loading && !models.length ? (
        <Text dimColor>No installed models found</Text>
      ) : null}
      {models.map((item, index) => (
        <Text key={item.name} inverse={index === selection}>
          {index === selection ? "›" : " "} {item.name}{" "}
          {item.parameterSize ?? ""} {item.quantization ?? ""}
        </Text>
      ))}
      {!loading ? (
        <>
          <Text inverse={selection === models.length}>
            {selection === models.length ? "›" : " "} Download configured:{" "}
            {configuredModel}
          </Text>
          <Text inverse={selection === models.length + 1}>
            {selection === models.length + 1 ? "›" : " "} Download another
            model…
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
    <Box
      borderStyle="double"
      borderColor="yellow"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="yellow">
        Approval required · {approval.path}
      </Text>
      <Text>{approval.explanation}</Text>
      <Box flexDirection="column">
        {diff.split("\n").map((line, index) => (
          <Text
            key={index}
            color={
              line.startsWith("+") && !line.startsWith("+++")
                ? "green"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "red"
                  : "gray"
            }
          >
            {line}
          </Text>
        ))}
      </Box>
      <Text>
        <Text bold color="green">
          Y
        </Text>{" "}
        apply exact patch ·{" "}
        <Text bold color="red">
          N
        </Text>{" "}
        reject
      </Text>
    </Box>
  );
}

function usageText(usage: ModelUsage | null): string {
  if (!usage) return "";
  const input =
    usage.promptTokens === undefined ? "" : `${usage.promptTokens} in`;
  const output =
    usage.generatedTokens === undefined ? "" : `${usage.generatedTokens} out`;
  return [input, output].filter(Boolean).join(" · ");
}
