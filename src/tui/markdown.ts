export type MarkdownBlock =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language?: string | undefined };

export type CodeToken = {
  text: string;
  kind: "plain" | "keyword" | "string" | "number" | "comment";
};

const keywordPattern = /^(?:const|let|var|function|class|interface|type|import|export|from|return|if|else|for|while|switch|case|break|async|await|try|catch|throw|new|extends|implements|public|private|protected|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|INTO|VALUES|SET|TABLE|AND|OR|AS)$/i;
const tokenPattern = /(\/\/.*$|#.*$|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|class|interface|type|import|export|from|return|if|else|for|while|switch|case|break|async|await|try|catch|throw|new|extends|implements|public|private|protected|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|INTO|VALUES|SET|TABLE|AND|OR|AS)\b|\b\d+(?:\.\d+)?\b)/gi;

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.split("\n");
  let text: string[] = [];
  let code: string[] | null = null;
  let language: string | undefined;

  const flushText = () => {
    if (text.length) blocks.push({ type: "text", content: text.join("\n") });
    text = [];
  };
  const flushCode = () => {
    if (code) blocks.push({ type: "code", content: code.join("\n"), language });
    code = null;
    language = undefined;
  };

  for (const line of lines) {
    const fence = line.match(/^```([^\s`]*)\s*$/);
    if (fence) {
      if (code) {
        flushCode();
      } else {
        flushText();
        code = [];
        language = fence[1] || undefined;
      }
      continue;
    }
    if (code) code.push(line);
    else text.push(line);
  }
  if (code) flushCode();
  flushText();
  return blocks;
}

export function tokenizeCodeLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: line.slice(cursor, index), kind: "plain" });
    const text = match[0];
    tokens.push({ text, kind: classifyToken(text) });
    cursor = index + text.length;
    if (text.startsWith("//") || text.startsWith("#")) break;
  }
  if (cursor < line.length) tokens.push({ text: line.slice(cursor), kind: "plain" });
  return tokens.length ? tokens : [{ text: line, kind: "plain" }];
}

function classifyToken(token: string): CodeToken["kind"] {
  if (token.startsWith("//") || token.startsWith("#")) return "comment";
  if (["'", '"', "`"].includes(token[0] ?? "")) return "string";
  if (/^\d/.test(token)) return "number";
  if (keywordPattern.test(token)) return "keyword";
  return "plain";
}
