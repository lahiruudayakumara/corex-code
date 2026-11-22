import { describe, expect, test } from "bun:test";
import {
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

});
