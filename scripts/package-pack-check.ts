import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "corex-pack-check-"));

try {
  const processHandle = Bun.spawn(
    ["npm", "pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: root,
      env: {
        ...process.env,
        npm_config_cache: join(temporaryRoot, "npm-cache"),
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`npm pack failed: ${stderr}`);

  const report = JSON.parse(stdout) as Array<{
    filename: string;
    files: Array<{ path: string }>;
  }>;
  const entry = report[0];
  if (!entry) throw new Error("npm pack returned no package report");
  const paths = new Set(entry.files.map((file) => file.path));
  for (const required of ["dist/corex.js", "README.md", "LICENSE", "package.json"]) {
    if (!paths.has(required)) throw new Error(`Package is missing ${required}`);
  }
  if ([...paths].some((path) => path.startsWith("src/") || path.startsWith("tests/"))) {
    throw new Error("Package unexpectedly contains source or test files");
  }
  console.log(`Package contents valid: ${entry.filename} (${paths.size} files)`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
