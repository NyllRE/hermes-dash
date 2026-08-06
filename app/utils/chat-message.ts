import type {
  HermesMessage,
  DisplayMessage,
  LocalMessage,
  DisplayToolCall,
  SessionSearchResult,
} from "~/types/hermes";

export function pairToolResults(messages: HermesMessage[]): DisplayMessage[] {
  const toolResults = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "tool" && m.tool_call_id && m.content) {
      toolResults.set(m.tool_call_id, m.content);
    }
  }

  const pairedIds = new Set<string>();

  const existing = messages.map((m) => {
    const out = toDisplayMessage(m);

    if (m.role === "assistant" && m.tool_calls?.length) {
      out.tool_calls = m.tool_calls.map((tc) => {
        const callId = tc.id;
        const result = callId ? toolResults.get(callId) : undefined;
        if (result) {
          pairedIds.add(callId);
          return { ...tc, result };
        }
        return tc;
      });
    }

    return out;
  });

  return existing.filter((m) => {
    if (m.role === "tool" && m.tool_call_id && pairedIds.has(m.tool_call_id)) {
      return false;
    }
    return true;
  });
}

export function toDisplayMessage(m: HermesMessage): DisplayMessage {
  return {
    id: String(m.id),
    role: m.role,
    content: m.content || "",
    parts: [{ type: "text" as const, text: m.content || "" }],
    createdAt: new Date(m.timestamp * 1000),
    reasoning_content: m.reasoning_content,
    tool_calls: m.tool_calls as DisplayToolCall[] | undefined,
    tool_name: m.tool_name,
    tool_call_id: m.tool_call_id,
    token_count: m.token_count,
    finish_reason: m.finish_reason,
  };
}

export function toLocalDisplayMessage(m: LocalMessage, index: number): DisplayMessage {
  return {
    id: `local-${index}`,
    role: m.role as "user" | "assistant",
    content: m.content,
    parts: [{ type: "text" as const, text: m.content }],
    createdAt: new Date(),
    tool_calls: m.tool_calls as DisplayToolCall[] | undefined,
  };
}

export function getToolResultContent(result: string): string {
  try {
    const parsed = JSON.parse(result) as SessionSearchResult;
    if (parsed.analysis) return parsed.analysis;
    if (parsed.results?.length) {
      const titles = parsed.results
        .map((r) => r.session?.title || r.title || "")
        .filter(Boolean);
      if (titles.length) return titles.map((t: string) => `- ${t}`).join("\n");
    }
    return result;
  } catch {
    return result;
  }
}
