import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CorexError } from "./errors";

const configSchema = z.object({
  provider: z.literal("ollama").default("ollama"),
  model: z.string().trim().min(1).default("qwen2.5-coder:7b"),
  ollama: z
    .object({
      baseUrl: z.url().default("http://127.0.0.1:11434"),
      keepAlive: z.string().trim().min(1).default("5m"),
    })
    .strict()
    .default({ baseUrl: "http://127.0.0.1:11434", keepAlive: "5m" }),
  agent: z
    .object({
      maxSteps: z.number().int().min(1).max(30).default(12),
      maxFileBytes: z.number().int().min(1_024).max(2_000_000).default(200_000),
      maxSearchResults: z.number().int().min(1).max(500).default(100),
    })
    .strict()
    .default({ maxSteps: 12, maxFileBytes: 200_000, maxSearchResults: 100 }),
}).strict();

export type CorexConfig = z.infer<typeof configSchema>;

export async function loadConfig(root: string): Promise<CorexConfig> {
  const path = join(root, "corex.config.json");
  let raw: unknown = {};

  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new CorexError(`Cannot load corex.config.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new CorexError(`Invalid corex.config.json:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export { configSchema };
