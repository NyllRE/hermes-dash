<script setup lang="ts">
const input = ref("");
const messages = ref<{ role: string; content: string }[]>([]);
const streaming = ref(false);

async function send() {
  const text = input.value.trim();
  if (!text) return;

  messages.value.push({ role: "user", content: text });
  input.value = "";
  streaming.value = true;

  try {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "hermes-agent",
        messages: messages.value.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      messages.value.push({ role: "assistant", content: `Error: ${err}` });
      return;
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "No response";
    messages.value.push({ role: "assistant", content: reply });
  } catch (e: any) {
    messages.value.push({ role: "assistant", content: `Error: ${e.message}` });
  } finally {
    streaming.value = false;
  }
}
</script>

<template>
  <UDashboardPanel id="chat" class="min-h-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <Navbar>
        <template #title>
          <span class="text-sm font-semibold">Chat</span>
        </template>
      </Navbar>
    </template>

    <template #body>
      <div class="flex-1 flex flex-col">
        <UContainer class="flex-1 flex flex-col gap-4 py-4 overflow-y-auto">
          <div
            v-if="!messages.length"
            class="flex-1 flex items-center justify-center text-sm text-muted"
          >
            Start a conversation
          </div>

          <div v-for="(msg, i) in messages" :key="i">
            <div class="flex items-center gap-2 mb-1">
              <UBadge
                :label="msg.role"
                :color="msg.role === 'user' ? 'primary' : 'info'"
                size="sm"
                variant="solid"
              />
            </div>
            <div
              class="text-sm whitespace-pre-wrap bg-elevated rounded-md p-3 border border-default font-mono text-xs"
            >
              {{ msg.content }}
            </div>
          </div>

          <div v-if="streaming" class="text-sm text-muted flex items-center gap-2">
            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
            Thinking...
          </div>
        </UContainer>

        <div class="sticky bottom-0 p-4 border-t border-default bg-default">
          <form @submit.prevent="send">
            <UChatPrompt
              v-model="input"
              :status="streaming ? 'streaming' : 'ready'"
              variant="subtle"
              :ui="{ base: 'px-1.5' }"
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
          </form>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
