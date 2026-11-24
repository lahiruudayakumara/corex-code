#!/usr/bin/env bun

import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { AgentSession } from "./agent/session";
import { loadConfig } from "./config";
import { CorexError, errorMessage } from "./errors";
import { formatBytes, OllamaModelManager, type PullProgress } from "./models/manager";
import { OllamaAdapter } from "./models/ollama";
import { findRepositoryRoot } from "./repository/root";
import { RepositoryTools } from "./repository/tools";
import { runTui } from "./tui/run";
import type { AgentEvent, ApprovalRequest } from "./types";
import { renderBanner } from "./ui/banner";
import { COREX_VERSION } from "./version";

const colors = {
  cyan: (text: string) => `\u001b[36m${text}\u001b[0m`,
  green: (text: string) => `\u001b[32m${text}\u001b[0m`,
  yellow: (text: string) => `\u001b[33m${text}\u001b[0m`,
  red: (text: string) => `\u001b[31m${text}\u001b[0m`,
  dim: (text: string) => `\u001b[2m${text}\u001b[0m`,
};

const program = new Command()
  .name("corex")
  .description("Local-first AI coding agent")
  .version(COREX_VERSION)
  .argument("[prompt...]", "run one prompt, or omit it for interactive mode")
  .option("-C, --cwd <path>", "repository directory", process.cwd())
  .option("--model <name>", "override the configured Ollama model")
  .option("--host <url>", "override the configured Ollama URL")
  .action(async (prompt: string[] | undefined, options: { cwd: string; model?: string; host?: string }) => {
    await run(prompt ?? [], options);
  });

const modelsCommand = program.command("models").description("manage local Ollama models");

modelsCommand
  .command("list")
  .description("list installed Ollama models")
  .option("--host <url>", "Ollama URL", "http://127.0.0.1:11434")
  .action(async (options: { host: string }) => {
    const models = await new OllamaModelManager(options.host).list();
    if (!models.length) {
      console.log("No local models are installed.");
      return;
    }
    for (const model of models) {
      const details = [model.parameterSize, model.quantization, formatBytes(model.size)].filter(Boolean).join(" · ");
      console.log(`${model.name}${details ? `\t${details}` : ""}`);
    }
  });

modelsCommand
  .command("pull")
  .description("download an Ollama model")
  .argument("<name>", "model name, for example qwen2.5-coder:7b")
  .option("--host <url>", "Ollama URL", "http://127.0.0.1:11434")
  .action(async (name: string, options: { host: string }) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.on("SIGINT", cancel);
    try {
      await new OllamaModelManager(options.host).pull(name, createProgressRenderer(), controller.signal);
      process.stdout.write(`\nDownloaded ${name}.\n`);
    } finally {
      process.off("SIGINT", cancel);
    }
  });

async function run(prompt: string[], options: { cwd: string; model?: string; host?: string }): Promise<void> {
  const root = await findRepositoryRoot(resolve(options.cwd));
  const config = await loadConfig(root);
  const requestedModel = options.model ?? config.model;
  const host = options.host ?? config.ollama.baseUrl;
  const repository = new RepositoryTools(root, config.agent);
  let activeController: AbortController | undefined;

  const cancel = () => {
    if (activeController) {
      activeController.abort();
      process.stdout.write(`\n${colors.yellow("Cancelling current operation...")}\n`);
    }
  };
  process.on("SIGINT", cancel);

  const modelName = requestedModel;
  const manager = new OllamaModelManager(host);

  try {
    if (prompt.length) {
      console.log(colors.cyan(renderBanner(COREX_VERSION)));
      console.log(colors.dim(`Repository: ${root}`));
      if (!(await manager.isInstalled(modelName))) {
        throw new CorexError(`Model '${modelName}' is not installed. Run: corex models pull ${modelName}`);
      }
      console.log(colors.dim(`Model: ${modelName} via ${host}`));
      const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
      const session = new AgentSession({
        model: new OllamaAdapter(modelName, host, config.ollama.keepAlive),
        repository,
        maxSteps: config.agent.maxSteps,
        approve: (request) => askApproval(rl, request),
        onEvent: renderEvent,
      });
      activeController = new AbortController();
      let streamed = false;
      process.stdout.write(`\n${colors.green("corex>")} `);
      try {
        const result = await session.run(prompt.join(" "), activeController.signal, (token) => {
          streamed = true;
          process.stdout.write(token);
        });
        if (!streamed && result.response) process.stdout.write(result.response);
        process.stdout.write("\n");
        if (result.changedFiles.length) console.log(colors.yellow(`Changed: ${result.changedFiles.join(", ")}`));
      } catch (error) {
        process.stdout.write("\n");
        console.error(colors.red(errorMessage(error)));
      } finally {
        activeController = undefined;
        rl.close();
      }
      return;
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new CorexError("Interactive mode requires a TTY; pass a prompt for non-interactive use");
    }
    process.off("SIGINT", cancel);
    process.stdout.write("\u001b[2J\u001b[H");
    await runTui({
      root,
      modelName,
      host,
      keepAlive: config.ollama.keepAlive,
      maxSteps: config.agent.maxSteps,
      repository,
      modelManager: manager,
    });
  } finally {
    process.off("SIGINT", cancel);
  }
}

async function askApproval(
  rl: ReturnType<typeof createInterface>,
  request: ApprovalRequest,
): Promise<boolean> {
  console.log(`\n${colors.yellow("Proposed change:")} ${request.path}`);
  console.log(request.explanation);
  console.log(request.diff);
  const answer = (await rl.question(colors.yellow("Apply this exact patch? [y/N] "))).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

function renderEvent(event: AgentEvent): void {
  switch (event.type) {
    case "tool_start":
      process.stdout.write(`\n${colors.dim(`→ ${event.tool}${event.summary ? ` ${event.summary}` : ""}`)}\n`);
      break;
    case "tool_result":
      process.stdout.write(`${colors.dim(`← ${event.tool}: ${event.summary}`)}\n`);
      break;
    case "approval":
      process.stdout.write(`${event.approved ? colors.green("✓ applied") : colors.yellow("○ rejected")} ${event.path}\n`);
      break;
    case "usage": {
      const parts = [
        event.usage.promptTokens === undefined ? undefined : `${event.usage.promptTokens} input`,
        event.usage.generatedTokens === undefined ? undefined : `${event.usage.generatedTokens} output`,
        event.usage.totalDurationMs === undefined ? undefined : `${Math.round(event.usage.totalDurationMs)} ms`,
      ].filter(Boolean);
      if (parts.length) process.stdout.write(`${colors.dim(`usage: ${parts.join(" · ")}`)}\n`);
      break;
    }
    case "warning":
      process.stdout.write(`${colors.yellow(`warning: ${event.message}`)}\n`);
  }
}

function createProgressRenderer(): (progress: PullProgress) => void {
  let previous = "";
  return (progress) => {
    const line = progress.percent === undefined ? progress.status : `${progress.status} ${progress.percent}%`;
    if (line === previous) return;
    previous = line;
    process.stdout.write(`\r${colors.dim(line.padEnd(70))}`);
  };
}

program.parseAsync().catch((error) => {
  const message = error instanceof CorexError ? error.message : errorMessage(error);
  console.error(colors.red(message));
  process.exitCode = 1;
});
