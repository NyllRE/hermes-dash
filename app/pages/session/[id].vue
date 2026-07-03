<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { toolIcon } from "~/composables/useToolIcons";

const route = useRoute("/session/[id]");
const sessionId = route.params.id as string;

const {
  data: messages,
  pending,
  error,
  refresh: refreshMessages,
} = useHermesSessionMessages(sessionId);
const { data: session, refresh: refreshSession } = useHermesSession(sessionId);

const input = ref("");
const streaming = ref(false);
const prevMessageCount = ref(0);

let isMounted = true;
const fetchAbort = new AbortController();
const sendAbort = new AbortController();

// Live polling — check for new messages every 2s while session is active
const { pause: pausePoll, resume: resumePoll } = useIntervalFn(
  async () => {
    if (!session.value?.id) return;
    if (session.value?.ended_at) {
      pausePoll();
      return;
    }
    await refreshSession(fetchAbort.signal);
    if (!isMounted) return;
    if (session.value?.ended_at) {
      pausePoll();
      return;
    }
    // Only fetch messages if session still active or message count unknown
    const newCount = session.value?.message_count ?? 0;
    if (newCount !== prevMessageCount.value) {
      prevMessageCount.value = newCount;
      await refreshMessages(fetchAbort.signal);
    }
  },
  2000,
  { immediate: false },
);

// Track the session lifecycle to start/stop polling
watch(
  () => session.value?.id,
  (id) => {
    if (id) {
      prevMessageCount.value = session.value?.message_count ?? 0;
      if (!session.value?.ended_at) resumePoll();
    }
  },
);

watch(
  () => session.value?.ended_at,
  (ended) => {
    if (ended) pausePoll();
  },
);

onUnmounted(() => {
  isMounted = false;
  pausePoll();
  fetchAbort.abort();
  sendAbort.abort();
});

const isLive = computed(() => session.value?.is_active && !session.value?.ended_at);

// Convert Hermes API messages to UIMessage-compatible shape for UChatMessages,
// pairing tool-role results with their corresponding tool calls on assistant messages.
const chatMessages = computed<any[]>(() => {
  const raw = messages.value?.messages || [];

  // Collect tool results by tool_call_id
  const toolResults = new Map<string, string>();
  for (const m of raw) {
    if (m.role === "tool" && m.tool_call_id && m.content) {
      toolResults.set(m.tool_call_id, m.content);
    }
  }

  // Map messages, attaching results to tool calls, and track paired IDs
  const pairedIds = new Set<string>();

  const existing = raw.map((m) => {
    const out: any = {
      id: String(m.id),
      role: m.role,
      content: m.content || "",
      parts: [{ type: "text" as const, text: m.content || "" }],
      createdAt: new Date(m.timestamp * 1000),
      reasoning_content: m.reasoning_content,
      tool_calls: m.tool_calls,
      tool_name: m.tool_name,
      tool_call_id: m.tool_call_id,
      token_count: m.token_count,
      finish_reason: m.finish_reason,
    };

    if (m.role === "assistant" && m.tool_calls?.length) {
      out.tool_calls = m.tool_calls.map((tc: any) => {
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

  // Remove tool-role messages whose results were already attached to their calls
  const filtered = existing.filter((m: any) => {
    if (m.role === "tool" && m.tool_call_id && pairedIds.has(m.tool_call_id)) {
      return false;
    }
    return true;
  });

  const local = localMessages.value.map((m, i) => ({
    id: `local-${i}`,
    role: m.role as "user" | "assistant",
    content: m.content,
    parts: [{ type: "text" as const, text: m.content }],
    createdAt: new Date(),
    tool_calls: (m as any).tool_calls,
  }));

  return [...filtered, ...local];
});

interface LocalMessage {
  role: string;
  content: string;
  tool_calls?: any[];
}

const localMessages = ref<LocalMessage[]>([]);

function getTcvVisionArgs(tc: any): ReturnType<typeof getVisionArgs> {
  return getVisionArgs(tc.function?.arguments);
}

const toolCallIcon = (tc: string): string => {
  return toolIcon(tc);
};

function getToolResultContent(result: string): string {
  try {
    const parsed = JSON.parse(result);
    if (parsed.analysis) return parsed.analysis;
    if (parsed.results?.length) {
      const titles = parsed.results
        .map((r: any) => r.session?.title || r.title || "")
        .filter(Boolean);
      if (titles.length) return titles.map((t: string) => `- ${t}`).join("\n");
    }
    return result;
  } catch {
    return result;
  }
}

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
        let existing = currentMsg.tool_calls.find((t: any) => t.index === tc.index);
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

async function send() {
  const text = input.value.trim();
  if (!text || streaming.value) return;

  localMessages.value.push({ role: "user", content: text });
  input.value = "";
  streaming.value = true;

  const currentMsg: LocalMessage = { role: "assistant", content: "" };
  localMessages.value.push(currentMsg);

  try {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  } catch (e: any) {
    if (!isMounted) return;
    currentMsg.content = `Error: ${e.message}`;
  } finally {
    streaming.value = false;
  }
}
</script>

<template>
  <UDashboardPanel id="session-detail" class="min-h-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <Navbar>
        <template #title>
          <span class="text-sm font-semibold truncate">{{
            session?.title || session?.preview || "Session"
          }}</span>
        </template>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-ccw"
          :disabled="pending"
          aria-label="Refresh"
          @click="refreshMessages(fetchAbort.signal) || refreshSession(fetchAbort.signal)"
        />
      </Navbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="pending" class="flex items-center gap-2 text-sm text-muted p-6">
        <UIcon name="i-lucide-loader-circle" class="animate-spin" />
        Loading messages...
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="text-sm text-error p-6">
        <UIcon name="i-lucide-alert-circle" class="shrink-0" />
        {{ error }}
      </div>

      <!-- Messages area -->
      <div v-else class="flex-1 flex flex-col">
        <!-- Session info badge -->
        <div
          v-if="session"
          class="text-xs text-muted font-mono px-6 pt-4 pb-2 flex items-center gap-2"
        >
          <span class="truncate">{{ session.id }}</span>
          <UBadge :label="session.source" size="sm" variant="subtle" color="neutral" />
          <UBadge
            :label="getSessionStatus(session).label"
            :color="getSessionStatus(session).color"
            size="sm"
            variant="soft"
          />
        </div>
        <UChatMessages
          :messages="chatMessages"
          :status="streaming || isLive ? 'streaming' : 'ready'"
          should-auto-scroll
          :assistant="{
            variant: 'naked',
            ui: { leadingIcon: 'size-5', body: 'w-full' },
          }"
          :user="{
            side: 'right',
            variant: 'soft',
          }"
          class="flex-1"
        >
          <template #content="{ message }">
            <!-- Reasoning -->
            <UChatReasoning
              v-if="(message as any).reasoning_content"
              :text="(message as any).reasoning_content"
              :streaming="streaming || message.id === chatMessages[chatMessages.length - 1]?.id"
              :shimmer="{
                spread: 1.5,
                duration: 1,
              }"
              :icon="
                streaming || (isLive && message.id === chatMessages[chatMessages.length - 1]?.id)
                  ? 'svg-spinners:bars-fade'
                  : 'ri:brain-ai-3-fill'
              "
              class="mb-2"
              :auto-close-delay="500"
              unmount-on-hide
              :ui="{
                trigger: '[&>.iconify]:opacity-0 hover:[&>.iconify]:opacity-100',
              }"
            >
              <ChatComark class="h-full" :markdown="(message as any).reasoning_content" />
            </UChatReasoning>

            <!-- Tool calls (on assistant messages) -->
            <template v-if="(message as any).tool_calls?.length">
              <UChatTool
                v-for="(tc, tcIndex) in (message as any).tool_calls"
                :key="`${(message as any).id}-tc-${tcIndex}`"
                :text="tc.function?.name || tc.name || tc.type"
                :default-open="
                  streaming || message.id === chatMessages[chatMessages.length - 1]?.id
                "
                :icon="toolCallIcon(tc.function?.name || tc.name || tc.type)"
                :suffix="JSON.parse(tc.function?.arguments).command"
                variant="card"
                chevron="trailing"
                class="mb-1 max-h-96 w-full"
                unmount-on-hide
                :ui="
                  (() => {
                    let parsed;
                    let defaultParsed = {};
                    try {
                      parsed = JSON.parse(tc.result);
                    } catch {
                      return defaultParsed;
                    }
                    return {
                      ...defaultParsed,
                      leadingIcon: parsed?.exit_code === 0 ? 'text-success' : 'text-error',
                    };
                  })()
                "
              >
                <ChatToolVision
                  v-if="getTcvVisionArgs(tc)"
                  :image-url="getTcvVisionArgs(tc)!.imageUrl"
                  :question="getTcvVisionArgs(tc)!.question"
                />

                <div v-else-if="tc.function?.name === 'terminal'">
                  <!-- ? uncomment the line below to see the raw tc data -->
                  <!-- <pre language="json" v-text="tc" /> -->
                  <div class="mb-3 flex gap-3">
                    <UBadge
                      :label="`Timeout: ${JSON.parse(tc.function?.arguments).timeout}s`"
                      variant="soft"
                      color="info"
                    />
                    <UBadge
                      :label="`exit_code: ${JSON.parse(tc.result).exit_code}`"
                      variant="soft"
                      :color="JSON.parse(tc.result).exit_code === 0 ? 'success' : 'error'"
                    />
                  </div>
                  <ChatComark
                    :markdown="`\`\`\`bash\n$ ${JSON.parse(tc.function?.arguments).command}\n${JSON.parse(tc.result).output || JSON.parse(tc.result).error}\n\`\`\``"
                  />
                </div>
                <ChatComark v-else-if="tc.function?.arguments" :markdown="tc.function.arguments" />
                <div
                  v-else-if="tc.result"
                  class="border-t border-default p-3 mt-3 rounded-md space-y-2"
                >
                  <UScrollArea
                    shadow
                    class="max-h-64 [&>h1]:text-muted"
                    :ui="{ viewport: 'gap-4' }"
                  >
                    <ChatComark
                      :markdown="JSON.parse(tc.result).output || JSON.parse(tc.result).error"
                    />
                  </UScrollArea>
                </div>
              </UChatTool>
            </template>

            <!-- Tool results (on tool-role messages) -->
            <template v-else-if="(message as any).role === 'tool'">
              <UChatTool
                :text="(message as any).tool_name || (message as any).tool_call_id || 'Tool'"
                icon="i-lucide-bolt"
                variant="inline"
                chevron="trailing"
                class="mb-1"
              >
                <pre class="text-xs text-muted overflow-x-auto whitespace-pre-wrap">{{
                  (message as any).content
                }}</pre>
              </UChatTool>
            </template>

            <!-- Text content (user / assistant messages) -->
            <ChatComark
              v-else-if="(message as any).role === 'assistant' && (message as any).content"
              :markdown="(message as any).content"
            />
            <p v-else-if="(message as any).role === 'user'" class="whitespace-pre-wrap">
              {{ (message as any).content || "" }}
            </p>
          </template>

          <!-- Footer metadata for each message -->
          <template #actions="{ message }">
            <span v-if="(message as any).token_count" class="text-xs text-muted font-mono"
              >{{ (message as any).token_count }} tok</span
            >
            <span v-if="(message as any).finish_reason" class="text-xs text-muted"
              >— {{ (message as any).finish_reason }}</span
            >
          </template>

          <!-- Streaming indicator at bottom -->
          <template #indicator>
            <div class="flex items-center gap-1.5">
              <ChatIndicator />
              <UChatShimmer text="Thinking..." class="text-sm" />
            </div>
          </template>
        </UChatMessages>

        <!-- Chat prompt -->
        <div class="sticky bottom-0 mt-5 border-t border-default bg-default p-4">
          <UChatPrompt
            v-model="input"
            :status="streaming ? 'streaming' : 'ready'"
            variant="subtle"
            :ui="{ base: 'px-1.5' }"
            @submit="send"
          >
            <template #footer>
              <UChatPromptSubmit
                :status="streaming ? 'streaming' : 'ready'"
                :disabled="!input.trim()"
                color="neutral"
                size="sm"
              />
            </template>
          </UChatPrompt>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
