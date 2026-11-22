import type { ToolCall } from "../types";

export function parseTextToolCalls(content: string, allowedNames: Set<string>): ToolCall[] | null {
  const json = unwrapJson(content);
  if (!json) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }

  const candidates = Array.isArray(value) ? value : [value];
  const calls: ToolCall[] = [];
  for (const candidate of candidates) {
    const call = parseCandidate(candidate, allowedNames);
    if (!call) return null;
    calls.push(call);
  }
  return calls.length ? calls : null;
}

function unwrapJson(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseCandidate(candidate: unknown, allowedNames: Set<string>): ToolCall | null {
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  const fn = record.function && typeof record.function === "object"
    ? (record.function as Record<string, unknown>)
    : record;
  const name = typeof fn.name === "string" ? fn.name : typeof record.tool === "string" ? record.tool : null;
  if (!name || !allowedNames.has(name)) return null;
  let args = fn.arguments ?? record.arguments ?? record.args ?? {};
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return null;
    }
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  return { function: { name, arguments: args } };
}
