import { afterEach, describe, expect, test } from "bun:test";
import { RepositoryTools } from "../src/repository/tools";
import { createGitRepository } from "./helpers";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

describe("repository tools", () => {
  test("lists, reads, and searches repository text", async () => {
    const repository = await createGitRepository();
    cleanups.push(repository.cleanup);
    const tools = new RepositoryTools(repository.path, { maxFileBytes: 200_000, maxSearchResults: 20 });
    expect(await tools.listFiles()).toContain("example.ts");
    const read = await tools.readFile("example.ts", 1, 10);
    expect(read.content).toContain("answer = 41");
    expect(await tools.search("answer")).toContain("example.ts:1");
  });
});
