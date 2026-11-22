import { readFile, realpath, stat } from "node:fs/promises";
import { relative } from "node:path";
import { CorexError } from "../errors";
import { runProcess } from "../process";
import { isSafeListedPath, resolveRepositoryFile } from "../safety/paths";

export class RepositoryTools {
  constructor(
    readonly root: string,
    private readonly limits: { maxFileBytes: number; maxSearchResults: number },
  ) {}

  async listFiles(limit = 200, signal?: AbortSignal): Promise<string[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 500);
    const result = await runProcess(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: this.root, signal },
    );
    return result.stdout
      .split("\0")
      .filter(Boolean)
      .filter(isSafeListedPath)
      .slice(0, boundedLimit);
  }

  async readFile(
    path: string,
    startLine = 1,
    endLine = 250,
  ): Promise<{ path: string; content: string; startLine: number; endLine: number; totalLines: number }> {
    if (startLine < 1 || endLine < startLine || endLine - startLine > 500) {
      throw new CorexError("Line range must be positive and contain at most 501 lines");
    }
    const resolved = await resolveRepositoryFile(this.root, path);
    const fileStats = await stat(resolved);
    if (fileStats.size > this.limits.maxFileBytes) {
      throw new CorexError(`File exceeds the ${this.limits.maxFileBytes}-byte read limit`);
    }
    const buffer = await readFile(resolved);
    if (buffer.includes(0)) throw new CorexError("Binary files are not supported");
    const lines = buffer.toString("utf8").split("\n");
    const actualEnd = Math.min(endLine, lines.length);
    return {
      path: relative(await realpath(this.root), resolved),
      content: lines.slice(startLine - 1, actualEnd).join("\n"),
      startLine,
      endLine: actualEnd,
      totalLines: lines.length,
    };
  }

  async search(pattern: string, glob?: string, signal?: AbortSignal): Promise<string> {
    if (!pattern.trim() || pattern.length > 500) throw new CorexError("Search pattern is invalid");
    const args = [
      "--line-number",
      "--column",
      "--no-heading",
      "--color=never",
      `--max-count=${this.limits.maxSearchResults}`,
    ];
    if (glob) args.push("--glob", glob);
    args.push(
      "--glob",
      "!.git/**",
      "--glob",
      "!.corex/**",
      "--glob",
      "!node_modules/**",
      "--glob",
      "!.env*",
      "--glob",
      "!**/.env*",
      "--glob",
      "!**/*.pem",
      "--glob",
      "!**/*.key",
      "--glob",
      "!**/credentials*",
      pattern,
      ".",
    );
    const result = await runProcess("rg", args, {
      cwd: this.root,
      signal,
      allowedExitCodes: [0, 1],
      maxOutputBytes: 500_000,
    });
    const matches = result.stdout.trim().split("\n").filter(Boolean).slice(0, this.limits.maxSearchResults);
    return matches.join("\n") || "No matches found";
  }
}
