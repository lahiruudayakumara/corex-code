import { describe, expect, test } from "bun:test";
import {
  buildModelChoices,
  matchesModelName,
  OllamaModelManager,
  validateModelName,
  type ModelCatalogClient,
  type PullProgress,
} from "../src/models/manager";

function clientWithModels(names: string[]): ModelCatalogClient {
  return {
    async list() {
      return {
        models: names.map((name) => ({ name, size: 4_000_000_000, details: { parameter_size: "7B" } })),
      };
    },
    async pull() {
      return {
        async *[Symbol.asyncIterator]() {
          yield { status: "downloading", completed: 50, total: 100 };
          yield { status: "success", completed: 100, total: 100 };
        },
      };
    },
  };
}

describe("Ollama model management", () => {
  test("lists installed models and accepts an implicit latest tag", async () => {
    const manager = new OllamaModelManager("http://localhost:11434", clientWithModels(["qwen:latest", "coder:7b"]));
    expect((await manager.list()).map((model) => model.name)).toEqual(["coder:7b", "qwen:latest"]);
    expect(await manager.isInstalled("qwen")).toBeTrue();
    expect(matchesModelName("coder:7b", "coder:7b")).toBeTrue();
  });

  test("streams model download progress", async () => {
    const manager = new OllamaModelManager("http://localhost:11434", clientWithModels([]));
    const progress: PullProgress[] = [];
    await manager.pull("qwen2.5-coder:7b", (event) => progress.push(event));
    expect(progress.map((event) => event.percent)).toEqual([50, 100]);
  });

  test("validates model names before download", () => {
    expect(() => validateModelName("qwen2.5-coder:7b")).not.toThrow();
    expect(() => validateModelName("bad model; rm -rf")).toThrow("unsupported characters");
  });

  test("combines active, installed, and downloadable open models", () => {
    const choices = buildModelChoices(
      [{ name: "qwen2.5-coder:3b", size: 1_800_000_000 }],
      "qwen2.5-coder:3b",
      "qwen2.5-coder:7b",
    );
    expect(choices[0]).toMatchObject({
      name: "qwen2.5-coder:3b",
      installed: true,
      active: true,
    });
    expect(choices.find((choice) => choice.name === "qwen2.5-coder:7b"))
      .toMatchObject({ installed: false, active: false });
  });

  test("allows a cancelled pull to be retried for resumable downloads", async () => {
    let pulls = 0;
    let aborts = 0;
    const client = clientWithModels([]);
    client.abort = () => {
      aborts += 1;
    };
    client.pull = async () => {
      pulls += 1;
      return {
        async *[Symbol.asyncIterator]() {
          yield { status: "downloading", completed: 25, total: 100 };
          yield { status: "success", completed: 100, total: 100 };
        },
      };
    };
    const manager = new OllamaModelManager("http://localhost:11434", client);
    const controller = new AbortController();
    await expect(
      manager.pull(
        "qwen2.5-coder:3b",
        () => controller.abort(),
        controller.signal,
      ),
    ).rejects.toThrow("cancelled");
    await manager.pull("qwen2.5-coder:3b", () => undefined);
    expect({ pulls, aborts }).toEqual({ pulls: 2, aborts: 1 });
  });

});
