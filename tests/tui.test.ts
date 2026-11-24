import { describe, expect, test } from "bun:test";
import {
  cycleMode,
  filterCommands,
  modeLabel,
  moveSelection,
  UI_COMMANDS,
  visibleTail,
} from "../src/tui/state";

describe("terminal UI state", () => {
  test("cycles through Build, Plan, and Ask modes", () => {
    expect(cycleMode("build")).toBe("plan");
    expect(cycleMode("plan")).toBe("ask");
    expect(cycleMode("ask")).toBe("build");
    expect(modeLabel("build")).toBe("Build");
  });

  test("wraps palette navigation", () => {
    expect(moveSelection(0, -1, 4)).toBe(3);
    expect(moveSelection(3, 1, 4)).toBe(0);
    expect(moveSelection(0, 1, 0)).toBe(0);
  });

  test("keeps the newest transcript items visible", () => {
    expect(visibleTail([1, 2, 3, 4], 2)).toEqual([3, 4]);
  });

  test("provides the complete command palette", () => {
    expect(UI_COMMANDS.map((command) => command.name)).toEqual([
      "/help",
      "/status",
      "/diff",
      "/model",
      "/copy",
      "/copy-code",
      "/clear",
      "/new",
      "/exit",
    ]);
  });

  test("filters slash commands as each character is typed", () => {
    expect(filterCommands("/")).toEqual(UI_COMMANDS);
    expect(filterCommands("/m").map((command) => command.name)).toEqual([
      "/model",
    ]);
    expect(filterCommands("/MO").map((command) => command.name)).toEqual([
      "/model",
    ]);
    expect(filterCommands("/copy-code 2").map((command) => command.name)).toEqual([
      "/copy-code",
    ]);
    expect(filterCommands("hello")).toEqual([]);
  });
});
