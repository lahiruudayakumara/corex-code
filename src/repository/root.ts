import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { CorexError } from "../errors";
import { runProcess } from "../process";

export async function findRepositoryRoot(cwd: string): Promise<string> {
  const start = await realpath(resolve(cwd));
  try {
    const result = await runProcess("git", ["rev-parse", "--show-toplevel"], { cwd: start });
    return await realpath(result.stdout.trim());
  } catch (error) {
    throw new CorexError(`Corex v0.1 requires a Git repository: ${error instanceof Error ? error.message : String(error)}`);
  }
}
