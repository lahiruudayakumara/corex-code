import { Ollama } from "ollama";
import { CorexError } from "../errors";

export type LocalModel = {
  name: string;
  size: number;
  parameterSize?: string | undefined;
  quantization?: string | undefined;
};

export type PullProgress = {
  status: string;
  completed: number;
  total: number;
  percent?: number | undefined;
};

export type CatalogModel = {
  name: string;
  parameterSize: string;
  estimatedSize: string;
  description: string;
};

export const OPEN_MODEL_CATALOG: CatalogModel[] = [
  {
    name: "qwen2.5-coder:3b",
    parameterSize: "3B",
    estimatedSize: "~1.9 GB",
    description: "Fast coding model for smaller computers",
  },
  {
    name: "qwen2.5-coder:7b",
    parameterSize: "7B",
    estimatedSize: "~4.7 GB",
    description: "Balanced code generation and fixing",
  },
  {
    name: "qwen2.5-coder:14b",
    parameterSize: "14B",
    estimatedSize: "~9 GB",
    description: "Stronger reasoning for larger machines",
  },
  {
    name: "qwen3-coder:30b",
    parameterSize: "30B",
    estimatedSize: "~19 GB",
    description: "Agentic coding with tool support",
  },
  {
    name: "deepseek-coder:6.7b",
    parameterSize: "6.7B",
    estimatedSize: "~3.8 GB",
    description: "General-purpose code model",
  },
  {
    name: "starcoder2:7b",
    parameterSize: "7B",
    estimatedSize: "~4 GB",
    description: "Open multilingual code generation",
  },
];

export type ModelChoice = {
  name: string;
  installed: boolean;
  active: boolean;
  parameterSize?: string | undefined;
  sizeLabel?: string | undefined;
  description?: string | undefined;
};

export function buildModelChoices(
  installedModels: LocalModel[],
  activeModel: string | null,
  configuredModel: string,
): ModelChoice[] {
  const installed: ModelChoice[] = installedModels.map((item) => ({
    name: item.name,
    installed: true,
    active: activeModel !== null && matchesModelName(item.name, activeModel),
    parameterSize: item.parameterSize,
    sizeLabel: formatBytes(item.size),
  }));
  const catalog = [...OPEN_MODEL_CATALOG];
  if (!catalog.some((item) => matchesModelName(item.name, configuredModel))) {
    catalog.unshift({
      name: configuredModel,
      parameterSize: "configured",
      estimatedSize: "size shown during download",
      description: "Configured default model",
    });
  }
  const downloadable = catalog
    .filter(
      (item) =>
        !installedModels.some((installedModel) =>
          matchesModelName(installedModel.name, item.name),
        ),
    )
    .map((item) => ({
      name: item.name,
      installed: false,
      active: false,
      parameterSize: item.parameterSize,
      sizeLabel: item.estimatedSize,
      description: item.description,
    }));
  return [...installed, ...downloadable];
}

type ProgressChunk = { status: string; completed?: number; total?: number };

export interface ModelCatalogClient {
  list(): Promise<{
    models: Array<{
      name: string;
      size: number;
      details?: { parameter_size?: string; quantization_level?: string } | undefined;
    }>;
  }>;
  pull(request: { model: string; stream: true }): Promise<AsyncIterable<ProgressChunk> & { abort?: () => void }>;
  abort?(): void;
}

export class OllamaModelManager {
  private readonly client: ModelCatalogClient;

  constructor(
    readonly host: string,
    client?: ModelCatalogClient,
  ) {
    this.client = client ?? (new Ollama({ host }) as ModelCatalogClient);
  }

  async list(): Promise<LocalModel[]> {
    try {
      const response = await this.client.list();
      return response.models
        .map((model) => ({
          name: model.name,
          size: model.size,
          parameterSize: model.details?.parameter_size,
          quantization: model.details?.quantization_level,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new CorexError(
        `Cannot reach Ollama at ${this.host}. Start it with \`ollama serve\` and try again: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async isInstalled(name: string): Promise<boolean> {
    const models = await this.list();
    return models.some((model) => matchesModelName(model.name, name));
  }

  async pull(
    name: string,
    onProgress: (progress: PullProgress) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    validateModelName(name);
    const onAbort = () => this.client.abort?.();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const stream = await this.client.pull({ model: name, stream: true });
      if (signal?.aborted) stream.abort?.();
      for await (const chunk of stream) {
        if (signal?.aborted) {
          stream.abort?.();
          throw new CorexError("Model download cancelled");
        }
        const completed = chunk.completed ?? 0;
        const total = chunk.total ?? 0;
        onProgress({
          status: chunk.status,
          completed,
          total,
          percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : undefined,
        });
      }
    } catch (error) {
      if (signal?.aborted) throw new CorexError("Model download cancelled");
      throw new CorexError(`Failed to download model '${name}': ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function matchesModelName(installed: string, requested: string): boolean {
  if (installed === requested) return true;
  return !requested.includes(":") && installed === `${requested}:latest`;
}

export function validateModelName(name: string): void {
  if (!name || name.length > 200 || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/.test(name)) {
    throw new CorexError("Model name contains unsupported characters");
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown size";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
