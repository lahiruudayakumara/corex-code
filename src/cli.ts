#!/usr/bin/env bun

import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { AgentSession } from "./agent/session";
import { loadConfig } from "./config";
import { CorexError, errorMessage } from "./errors";
import { OllamaAdapter } from "./models/ollama";
import { gitDiff, gitStatus } from "./repository/git";
import { findRepositoryRoot } from "./repository/root";
import { RepositoryTools } from "./repository/tools";
import type { AgentEvent, ApprovalRequest } from "./types";

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
  .version("0.1.0")
  .argument("[prompt...]", "run one prompt, or omit it for interactive mode")
  .option("-C, --cwd <path>", "repository directory", process.cwd())
  .option("--model <name>", "override the configured Ollama model")
  .option("--host <url>", "override the configured Ollama URL")
  .action(async (prompt: string[] | undefined, options: { cwd: string; model?: string; host?: string }) => {
    await run(prompt ?? [], options);
  });

async function run(prompt: string[], options: { cwd: string; model?: string; host?: string }): Promise<void> {
  const root = await findRepositoryRoot(resolve(options.cwd));
  const config = await loadConfig(root);
  const modelName = options.model ?? config.model;
  const host = options.host ?? config.ollama.baseUrl;
  const repository = new RepositoryTools(root, config.agent);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let activeController: AbortController | undefined;

  const session = new AgentSession({
    model: new OllamaAdapter(modelName, host, config.ollama.keepAlive),
    repository,
    maxSteps: config.agent.maxSteps,
    approve: (request) => askApproval(rl, request),
    onEvent: renderEvent,
  });

  const cancel = () => {
    if (activeController) {
      activeController.abort();
      process.stdout.write(`\n${colors.yellow("Cancelling current turn...")}\n`);
    } else {
      rl.close();
    }
  };
  process.on("SIGINT", cancel);

  console.log(colors.cyan("Corex Code v0.1"));
  console.log(colors.dim(`Repository: ${root}`));
  console.log(colors.dim(`Model: ${modelName} via ${host}`));

  const execute = async (input: string) => {
    activeController = new AbortController();
    let streamed = false;
    process.stdout.write(`\n${colors.green("corex>")} `);
    try {
      const result = await session.run(input, activeController.signal, (token) => {
        streamed = true;
        process.stdout.write(token);
      });
      if (!streamed && result.response) process.stdout.write(result.response);
      process.stdout.write("\n");
      if (result.changedFiles.length) {
        console.log(colors.yellow(`Changed: ${result.changedFiles.join(", ")}`));
      }
    } catch (error) {
      process.stdout.write("\n");
      console.error(colors.red(errorMessage(error)));
    } finally {
      activeController = undefined;
    }
  };

  try {
    if (prompt.length) {
      await execute(prompt.join(" "));
      return;
    }

    console.log(colors.dim("Commands: /help, /status, /diff, /exit"));
    while (true) {
      const input = (await rl.question(`\n${colors.cyan("you>")} `)).trim();
      if (!input) continue;
      if (input === "/exit" || input === "/quit") break;
      if (input === "/help") {
        console.log("Describe a coding task. Corex will inspect the repository and ask before applying a patch.");
        console.log("/status shows Git status, /diff shows the current unstaged diff, /exit closes Corex.");
        continue;
      }
      if (input === "/status") {
        console.log(await gitStatus(root));
        continue;
      }
      if (input === "/diff") {
        console.log(await gitDiff(root));
        continue;
      }
      await execute(input);
    }
  } finally {
    process.off("SIGINT", cancel);
    rl.close();
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

program.parseAsync().catch((error) => {
  const message = error instanceof CorexError ? error.message : errorMessage(error);
  console.error(colors.red(message));
  process.exitCode = 1;
});
