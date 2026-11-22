import { afterEach, describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { temporaryDirectory } from "./helpers";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

describe("configuration", () => {
  test("uses safe local defaults when no config exists", async () => {
    const directory = await temporaryDirectory("corex-config-");
    cleanups.push(directory.cleanup);
    const config = await loadConfig(directory.path);
    expect(config.provider).toBe("ollama");
    expect(config.ollama.baseUrl).toBe("http://127.0.0.1:11434");
    expect(config.agent.maxSteps).toBe(12);
  });

  test("rejects invalid configuration", async () => {
    const directory = await temporaryDirectory("corex-config-");
    cleanups.push(directory.cleanup);
    await writeFile(join(directory.path, "corex.config.json"), JSON.stringify({ provider: "unknown" }));
    expect(loadConfig(directory.path)).rejects.toThrow("Invalid corex.config.json");
  });

  test("rejects unknown configuration keys", async () => {
    const directory = await temporaryDirectory("corex-config-");
    cleanups.push(directory.cleanup);
    await writeFile(join(directory.path, "corex.config.json"), JSON.stringify({ modle: "typo" }));
    expect(loadConfig(directory.path)).rejects.toThrow("Unrecognized key");
  });
});
