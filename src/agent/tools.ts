import { z } from "zod";
import type { ModelTool } from "../types";

export const toolSchemas = {
  list_files: z.object({ limit: z.number().int().min(1).max(500).default(200) }),
  read_file: z.object({
    path: z.string().min(1),
    startLine: z.number().int().min(1).default(1),
    endLine: z.number().int().min(1).max(10_000_000).default(250),
  }),
  search_files: z.object({
    pattern: z.string().min(1).max(500),
    glob: z.string().min(1).max(200).optional(),
  }),
  show_diff: z.object({ path: z.string().min(1).optional() }),
  propose_patch: z.object({
    path: z.string().min(1),
    oldText: z.string().min(1),
    newText: z.string(),
    explanation: z.string().min(1).max(1_000),
  }),
};

export type ToolName = keyof typeof toolSchemas;

export const modelTools: ModelTool[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List tracked and unignored repository files. Use this to discover the project structure.",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 500, default: 200 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a bounded line range from a text file inside the repository.",
      parameters: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" },
          startLine: { type: "integer", minimum: 1, default: 1 },
          endLine: { type: "integer", minimum: 1, default: 250 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search repository text with ripgrep and return file, line, column, and matching text.",
      parameters: {
        type: "object",
        required: ["pattern"],
        properties: {
          pattern: { type: "string" },
          glob: { type: "string", description: "Optional ripgrep glob such as **/*.ts" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_diff",
      description: "Show the current unstaged Git diff, optionally for one repository-relative file.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_patch",
      description:
        "Propose one exact replacement in an existing file. You must read the file first. oldText must be a unique verbatim excerpt. The user reviews the generated diff before any write.",
      parameters: {
        type: "object",
        required: ["path", "oldText", "newText", "explanation"],
        properties: {
          path: { type: "string" },
          oldText: { type: "string" },
          newText: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
  },
];

export function parseToolArguments(name: string, input: unknown): { name: ToolName; args: unknown } {
  if (!(name in toolSchemas)) throw new Error(`Unknown tool: ${name}`);
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch {
      throw new Error(`Invalid JSON arguments for ${name}`);
    }
  }
  const toolName = name as ToolName;
  return { name: toolName, args: toolSchemas[toolName].parse(value) };
}
