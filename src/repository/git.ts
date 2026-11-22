import { runProcess } from "../process";
import { isSafeListedPath, validateRelativePath } from "../safety/paths";

export async function gitStatus(root: string, signal?: AbortSignal): Promise<string> {
  const result = await runProcess("git", ["status", "--short", "--branch"], { cwd: root, signal });
  return result.stdout.trim();
}

export async function gitDiff(root: string, path?: string, signal?: AbortSignal): Promise<string> {
  const args = ["diff", "--no-ext-diff", "--no-color"];
  if (path) {
    args.push("--", validateRelativePath(path));
  } else {
    const names = await runProcess("git", ["diff", "--name-only", "-z"], { cwd: root, signal });
    const safePaths = names.stdout.split("\0").filter(Boolean).filter(isSafeListedPath);
    if (!safePaths.length) return "No unstaged diff";
    args.push("--", ...safePaths);
  }
  const result = await runProcess("git", args, { cwd: root, signal, maxOutputBytes: 1_000_000 });
  return result.stdout.trim() || "No unstaged diff";
}
