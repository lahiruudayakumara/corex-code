import { Ollama, type Message, type Tool } from "ollama";
import { CorexError } from "../errors";
import type { ChatMessage, ModelAdapter, ModelRequest, ModelResponse, ToolCall } from "../types";
import { parseTextToolCalls } from "./tool-fallback";

function toOllamaMessage(message: ChatMessage): Message {
  const result: Message = { role: message.role, content: message.content };
  if (message.toolName) result.tool_name = message.toolName;
  if (message.toolCalls) result.tool_calls = message.toolCalls as NonNullable<Message["tool_calls"]>;
  return result;
}

export class OllamaAdapter implements ModelAdapter {
  readonly name: string;
  private readonly client: Ollama;

  constructor(
    private readonly model: string,
    host: string,
    private readonly keepAlive: string,
  ) {
    this.name = `ollama:${model}`;
    this.client = new Ollama({ host });
  }

  async chat(request: ModelRequest): Promise<ModelResponse> {
    const onAbort = () => this.client.abort();
    request.signal.addEventListener("abort", onAbort, { once: true });
    try {
      const stream = await this.client.chat({
        model: this.model,
        messages: request.messages.map(toOllamaMessage),
        tools: request.tools as Tool[],
        stream: true,
        keep_alive: this.keepAlive,
        options: { temperature: 0.1 },
      });
      if (request.signal.aborted) stream.abort();
      let content = "";
      let held = "";
      let classification: "unknown" | "candidate" | "stream" = "unknown";
      const toolCalls: ToolCall[] = [];
      let usage: ModelResponse["usage"];
      for await (const chunk of stream) {
        if (request.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const token = chunk.message.content ?? "";
        if (token) {
          content += token;
          if (classification === "unknown") {
            held += token;
            const first = held.trimStart()[0];
            if (first) {
              classification = first === "{" || first === "[" || first === "`" ? "candidate" : "stream";
              if (classification === "stream") {
                request.onToken(held);
                held = "";
              }
            }
          } else if (classification === "candidate") {
            held += token;
          } else {
            request.onToken(token);
          }
        }
        if (chunk.message.tool_calls?.length) {
          toolCalls.push(...(chunk.message.tool_calls as ToolCall[]));
        }
        if (chunk.done) {
          usage = {
            promptTokens: chunk.prompt_eval_count,
            generatedTokens: chunk.eval_count,
            totalDurationMs: chunk.total_duration ? chunk.total_duration / 1_000_000 : undefined,
          };
        }
      }
      const textCalls = parseTextToolCalls(content, new Set(request.tools.map((tool) => tool.function.name)));
      if (!toolCalls.length && textCalls) {
        toolCalls.push(...textCalls);
        content = "";
      } else if (textCalls) {
        content = "";
      } else if (classification === "candidate" && held) {
        request.onToken(held);
      }
      const message: ChatMessage = { role: "assistant", content };
      if (toolCalls.length) message.toolCalls = toolCalls;
      return usage ? { message, usage } : { message };
    } catch (error) {
      if (request.signal.aborted) throw new CorexError("Model request cancelled");
      const message = error instanceof Error ? error.message : String(error);
      throw new CorexError(`Cannot connect to ${this.name}: ${message}`);
    } finally {
      request.signal.removeEventListener("abort", onAbort);
    }
  }
}
