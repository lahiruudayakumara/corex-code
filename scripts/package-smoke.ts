import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import packageJson from "../package.json";

const root = resolve(import.meta.dir, "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "corex-package-"));

try {
  await run(["npm", "pack", "--ignore-scripts", "--pack-destination", temporaryRoot], root);
  const archive = (await readdir(temporaryRoot)).find((name) => name.endsWith(".tgz"));
  if (!archive) throw new Error("npm pack did not create an archive");

  const installRoot = join(temporaryRoot, "install");
  await mkdir(installRoot);
  await run(["npm", "init", "--yes"], installRoot);
  await run(
    [
      "npm",
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(temporaryRoot, archive),
    ],
    installRoot,
  );

  const executable = join(installRoot, "node_modules", ".bin", "corex");
  const version = await run([executable, "--version"], installRoot);
  if (version.stdout.trim() !== packageJson.version) {
    throw new Error(`Installed CLI reported unexpected version: ${version.stdout.trim()}`);
  }
  const help = await run([executable, "--help"], installRoot);
  if (!help.stdout.includes("Local-first AI coding agent")) {
    throw new Error("Installed CLI help output is invalid");
  }
  console.log(`Package smoke test passed: ${archive}`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function run(
  command: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const processHandle = Bun.spawn(command, {
    cwd,
    env: {
      ...process.env,
      npm_config_cache: join(temporaryRoot, "npm-cache"),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed (${exitCode}): ${stderr}`);
  }
  return { stdout, stderr };
}
