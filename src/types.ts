export type ToolCall = {
  function: {
    name: string;
    arguments: unknown;
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolName?: string | undefined;
  toolCalls?: ToolCall[] | undefined;
};

export type ModelUsage = {
  promptTokens?: number | undefined;
  generatedTokens?: number | undefined;
  totalDurationMs?: number | undefined;
};

export type ModelResponse = {
  message: ChatMessage;
  usage?: ModelUsage;
};

export type ModelRequest = {
  messages: ChatMessage[];
  tools: ModelTool[];
  signal: AbortSignal;
  onToken: (token: string) => void;
};

export interface ModelAdapter {
  readonly name: string;
  chat(request: ModelRequest): Promise<ModelResponse>;
}

export type ModelTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AgentEvent =
  | { type: "tool_start"; tool: string; summary: string }
  | { type: "tool_result"; tool: string; summary: string }
  | { type: "approval"; path: string; approved: boolean }
  | { type: "usage"; usage: ModelUsage }
  | { type: "warning"; message: string };

export type ApprovalRequest = {
  path: string;
  explanation: string;
  diff: string;
};

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;
