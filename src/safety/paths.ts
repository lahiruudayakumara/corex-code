import { lstat, realpath } from "node:fs/promises";
import { basename, isAbsolute, join, normalize, relative, sep } from "node:path";
import { CorexError } from "../errors";

const sensitiveBasenames = [/^\.env(?:\..+)?$/i, /\.pem$/i, /\.key$/i, /^credentials(?:\..+)?$/i];
const deniedSegments = new Set([".git", ".corex", "node_modules"]);

export function validateRelativePath(input: string): string {
  if (!input || input.includes("\0")) throw new CorexError("Path is empty or invalid");
  if (isAbsolute(input)) throw new CorexError("Absolute paths are not allowed");
  const normalized = normalize(input).replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new CorexError("Path escapes the repository root");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => deniedSegments.has(segment))) {
    throw new CorexError("Access to internal or dependency directories is not allowed");
  }
  if (sensitiveBasenames.some((pattern) => pattern.test(basename(normalized)))) {
    throw new CorexError("Access to sensitive files is not allowed");
  }
  if (segments.some((segment) => /^\.env(?:\..+)?$/i.test(segment))) {
    throw new CorexError("Access to sensitive files is not allowed");
  }
  return normalized.replace(/^\.\//, "");
}

export async function resolveRepositoryFile(root: string, input: string): Promise<string> {
  const normalized = validateRelativePath(input);
  const resolvedRoot = await realpath(root);
  const candidate = join(resolvedRoot, normalized);
  const resolved = await realpath(candidate);
  const fromRoot = relative(resolvedRoot, resolved);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new CorexError("Resolved path escapes the repository root");
  }
  const stats = await lstat(resolved);
  if (!stats.isFile()) throw new CorexError("Path is not a regular file");
  return resolved;
}

export function isSafeListedPath(input: string): boolean {
  try {
    validateRelativePath(input);
    return true;
  } catch {
    return false;
  }
}
