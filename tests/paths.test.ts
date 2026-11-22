import { afterEach, describe, expect, test } from "bun:test";
import { realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveRepositoryFile, validateRelativePath } from "../src/safety/paths";
import { temporaryDirectory } from "./helpers";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

describe("repository path policy", () => {
  test("rejects traversal, absolute, Git, and secret paths", () => {
    expect(() => validateRelativePath("../secret.txt")).toThrow("escapes");
    expect(() => validateRelativePath("/tmp/secret.txt")).toThrow("Absolute");
    expect(() => validateRelativePath(".git/config")).toThrow("internal");
    expect(() => validateRelativePath("node_modules/package/index.js")).toThrow("dependency");
    expect(() => validateRelativePath(".env.local")).toThrow("sensitive");
    expect(() => validateRelativePath("private.key")).toThrow("sensitive");
  });

  test("allows a regular repository file", async () => {
    const directory = await temporaryDirectory("corex-path-");
    cleanups.push(directory.cleanup);
    await writeFile(join(directory.path, "safe.ts"), "export {};\n");
    expect(await resolveRepositoryFile(directory.path, "safe.ts")).toBe(await realpath(join(directory.path, "safe.ts")));
  });

  test("rejects a symlink that resolves outside the repository", async () => {
    const repository = await temporaryDirectory("corex-path-");
    const outside = await temporaryDirectory("corex-outside-");
    cleanups.push(repository.cleanup, outside.cleanup);
    const secret = join(outside.path, "secret.txt");
    await writeFile(secret, "nope");
    await symlink(secret, join(repository.path, "link.txt"));
    expect(resolveRepositoryFile(repository.path, "link.txt")).rejects.toThrow("escapes");
  });
});
