import type { AgentMode } from "../types";

export type UiCommand = {
  name: string;
  description: string;
};

export const UI_COMMANDS: UiCommand[] = [
  { name: "/help", description: "Show commands and keyboard shortcuts" },
  { name: "/status", description: "Show Git status" },
  { name: "/diff", description: "Show the safe unstaged Git diff" },
  { name: "/model", description: "Select or download an Ollama model" },
  { name: "/clear", description: "Clear visible conversation" },
  { name: "/new", description: "Start a new agent session" },
  { name: "/exit", description: "Exit Corex" },
];

const MODES: AgentMode[] = ["build", "plan", "ask"];

export function cycleMode(mode: AgentMode): AgentMode {
  const index = MODES.indexOf(mode);
  return MODES[(index + 1) % MODES.length]!;
}

export function modeLabel(mode: AgentMode): string {
  return mode[0]!.toUpperCase() + mode.slice(1);
}

export function moveSelection(current: number, direction: -1 | 1, length: number): number {
  if (length <= 0) return 0;
  return (current + direction + length) % length;
}

export function visibleTail<T>(items: T[], limit: number): T[] {
  return items.slice(Math.max(0, items.length - Math.max(1, limit)));
}
