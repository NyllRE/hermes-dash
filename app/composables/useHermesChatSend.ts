import type { HermesMessage, LocalMessage } from "~/types/hermes";

export function useHermesChatSend(messages: Ref<{ messages: HermesMessage[] } | null>) {
  const { csrf, headerName } = useCsrf();
  const streaming = ref(false);
  const localMessages = ref<LocalMessage[]>([]);
  const sendAbort = new AbortController();
  let isMounted = true;

  function sendSSEData(line: string, currentMsg: LocalMessage) {
    if (!isMounted) return;
    if (!line.startsWith("data: ")) return;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload);
      const delta = parsed.choices?.[0]?.delta;
      const content = delta?.content;
      if (content) currentMsg.content += content;
      const toolCalls = delta?.tool_calls;
      if (toolCalls) {
        if (!currentMsg.tool_calls) currentMsg.tool_calls = [];
        for (const tc of toolCalls) {
          let existing = currentMsg.tool_calls.find((t) => t.index === tc.index);
          if (!existing) {
            existing = {
              index: tc.index,
              id: tc.id,
              function: { name: "", arguments: "" },
              type: "function",
            };
            currentMsg.tool_calls.push(existing);
          }
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.function.name += tc.function.name;
          if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
        }
      }
    } catch {
      /* skip malformed chunks */
    }
  }

  async function send(text: string) {
    if (!text.trim() || streaming.value) return;

    localMessages.value.push({ role: "user", content: text });
    streaming.value = true;

    const currentMsg: LocalMessage = { role: "assistant", content: "" };
    localMessages.value.push(currentMsg);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      // Send the CSRF token when one is present (nuxt-csurf protects POST).
      if (csrf) headers[headerName] = csrf;

      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers,
        signal: sendAbort.signal,
        body: JSON.stringify({
          stream: true,
          messages: [
            ...(messages.value?.messages || []).map((m) => ({ role: m.role, content: m.content })),
            ...localMessages.value.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      if (!res.ok) {
        currentMsg.content = await res.text().catch(() => res.statusText);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        currentMsg.content = "No response stream";
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!isMounted) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) sendSSEData(line, currentMsg);
      }
      if (buffer.trim() && isMounted) sendSSEData(buffer, currentMsg);
    } catch (e: unknown) {
      if (!isMounted) return;
      currentMsg.content = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      streaming.value = false;
    }
  }

  onUnmounted(() => {
    isMounted = false;
    sendAbort.abort();
  });

  return { streaming, localMessages, send, cancel: () => sendAbort.abort() };
}
