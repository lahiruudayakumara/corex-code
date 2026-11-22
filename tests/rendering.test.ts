import { describe, expect, test } from "bun:test";
import { parseTextToolCalls } from "../src/models/tool-fallback";
import { parseMarkdownBlocks, tokenizeCodeLine } from "../src/tui/markdown";

describe("text tool-call compatibility", () => {
  const allowed = new Set(["search_files", "read_file"]);

  test("recognizes a declared tool emitted as JSON text", () => {
    expect(
      parseTextToolCalls(
        '{"name":"search_files","arguments":{"pattern":"UPDATE users"}}',
        allowed,
      ),
    ).toEqual([
      { function: { name: "search_files", arguments: { pattern: "UPDATE users" } } },
    ]);
  });

  test("recognizes a fenced function call with string arguments", () => {
    expect(
      parseTextToolCalls(
        '```json\n{"function":{"name":"read_file","arguments":"{\\"path\\":\\"README.md\\"}"}}\n```',
        allowed,
      )?.[0]?.function,
    ).toEqual({ name: "read_file", arguments: { path: "README.md" } });
  });

  test("does not consume ordinary JSON or undeclared tools", () => {
    expect(parseTextToolCalls('{"answer":42}', allowed)).toBeNull();
    expect(parseTextToolCalls('{"name":"run_shell","arguments":{}}', allowed)).toBeNull();
  });
});

describe("terminal rich text", () => {
  test("separates prose and fenced code", () => {
    expect(parseMarkdownBlocks("Use this:\n```ts\nconst value = 42;\n```\nDone.")).toEqual([
      { type: "text", content: "Use this:" },
      { type: "code", language: "ts", content: "const value = 42;" },
      { type: "text", content: "Done." },
    ]);
  });

  test("classifies common code tokens for color rendering", () => {
    const tokens = tokenizeCodeLine('const answer = "yes"; // result');
    expect(tokens.some((token) => token.kind === "keyword" && token.text === "const")).toBeTrue();
    expect(tokens.some((token) => token.kind === "string" && token.text === '"yes"')).toBeTrue();
    expect(tokens.some((token) => token.kind === "comment")).toBeTrue();
  });
});
