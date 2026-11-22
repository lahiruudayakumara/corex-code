import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentSession } from "../src/agent/session";
import { RepositoryTools } from "../src/repository/tools";
import type { ModelAdapter, ModelRequest, ModelResponse } from "../src/types";
import { createGitRepository } from "./helpers";

class FakeModel implements ModelAdapter {
  readonly name = "fake";
  private index = 0;

  constructor(private readonly responses: ModelResponse[]) {}

  async chat(request: ModelRequest): Promise<ModelResponse> {
    if (request.signal.aborted) throw new Error("cancelled");
    const response = this.responses[this.index++];
    if (!response) throw new Error("No fake response configured");
    request.onToken(response.message.content);
    return response;
  }
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

function responses(): ModelResponse[] {
  return [
    {
      message: {
        role: "assistant",
        content: "",
        toolCalls: [{ function: { name: "read_file", arguments: { path: "example.ts" } } }],
      },
    },
    {
      message: {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            function: {
              name: "propose_patch",
              arguments: {
                path: "example.ts",
                oldText: "answer = 41",
                newText: "answer = 42",
                explanation: "Correct the answer",
              },
            },
          },
        ],
      },
    },
    { message: { role: "assistant", content: "Updated the answer." } },
  ];
}

describe("agent session", () => {
  test("keeps Plan mode read-only even when the model requests a patch", async () => {
    const repository = await createGitRepository();
    cleanups.push(repository.cleanup);
    let approvalRequested = false;
    const session = new AgentSession({
      model: new FakeModel(responses()),
      repository: new RepositoryTools(repository.path, { maxFileBytes: 200_000, maxSearchResults: 20 }),
      maxSteps: 5,
      approve: async () => {
        approvalRequested = true;
        return true;
      },
    });
    const result = await session.run("Plan the change", new AbortController().signal, () => undefined, "plan");
    expect(result.changedFiles).toEqual([]);
    expect(approvalRequested).toBeFalse();
    expect(await readFile(join(repository.path, "example.ts"), "utf8")).toContain("41");
  });

  test("refuses a patch when the model did not read the file first", async () => {
    const repository = await createGitRepository();
    cleanups.push(repository.cleanup);
    const model = new FakeModel([
      responses()[1]!,
      { message: { role: "assistant", content: "The edit was refused." } },
    ]);
    let approvalRequested = false;
    const session = new AgentSession({
      model,
      repository: new RepositoryTools(repository.path, { maxFileBytes: 200_000, maxSearchResults: 20 }),
      maxSteps: 3,
      approve: async () => {
        approvalRequested = true;
        return true;
      },
    });
    const result = await session.run("Fix the answer", new AbortController().signal, () => undefined);
    expect(result.changedFiles).toEqual([]);
    expect(approvalRequested).toBeFalse();
    expect(await readFile(join(repository.path, "example.ts"), "utf8")).toContain("41");
  });

  test("leaves the file unchanged when the user rejects a patch", async () => {
    const repository = await createGitRepository();
    cleanups.push(repository.cleanup);
    const session = new AgentSession({
      model: new FakeModel(responses()),
      repository: new RepositoryTools(repository.path, { maxFileBytes: 200_000, maxSearchResults: 20 }),
      maxSteps: 5,
      approve: async () => false,
    });
    const result = await session.run("Fix the answer", new AbortController().signal, () => undefined);
    expect(result.changedFiles).toEqual([]);
    expect(await readFile(join(repository.path, "example.ts"), "utf8")).toContain("41");
  });

  test("applies an approved patch and reports the changed file", async () => {
    const repository = await createGitRepository();
    cleanups.push(repository.cleanup);
    const session = new AgentSession({
      model: new FakeModel(responses()),
      repository: new RepositoryTools(repository.path, { maxFileBytes: 200_000, maxSearchResults: 20 }),
      maxSteps: 5,
      approve: async (request) => {
        expect(request.diff).toContain("answer = 42");
        return true;
      },
    });
    const result = await session.run("Fix the answer", new AbortController().signal, () => undefined);
    expect(result.changedFiles).toEqual(["example.ts"]);
    expect(await readFile(join(repository.path, "example.ts"), "utf8")).toContain("42");
  });
});
