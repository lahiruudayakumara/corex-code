import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function temporaryDirectory(prefix: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) };
}

export async function run(command: string[], cwd: string): Promise<void> {
  const process = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()]);
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed: ${stderr}`);
}

export async function createGitRepository(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const directory = await temporaryDirectory("corex-test-");
  await run(["git", "init", "-q"], directory.path);
  await writeFile(join(directory.path, "example.ts"), "export const answer = 41;\n", "utf8");
  await run(["git", "add", "example.ts"], directory.path);
  return directory;
}
