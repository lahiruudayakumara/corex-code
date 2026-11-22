import { render } from "ink";
import type { OllamaModelManager } from "../models/manager";
import type { RepositoryTools } from "../repository/tools";
import { CorexTui } from "./app";

type RunTuiOptions = {
  root: string;
  modelName: string;
  host: string;
  keepAlive: string;
  maxSteps: number;
  repository: RepositoryTools;
  modelManager: OllamaModelManager;
};

export async function runTui(options: RunTuiOptions): Promise<void> {
  // Bun does not keep the process alive for an unresolved Promise alone.
  // Keep one lightweight handle active while Ink owns stdin.
  const keepAlive = setInterval(() => undefined, 1_000);
  process.stdout.write("\u001b[?1049h\u001b[2J\u001b[H");
  const instance = render(
    <CorexTui
      root={options.root}
      initialModel={options.modelName}
      host={options.host}
      keepAlive={options.keepAlive}
      maxSteps={options.maxSteps}
      repository={options.repository}
      modelManager={options.modelManager}
    />,
    { exitOnCtrlC: false },
  );
  try {
    await instance.waitUntilExit();
  } finally {
    clearInterval(keepAlive);
    process.stdout.write("\u001b[?1049l");
  }
}
