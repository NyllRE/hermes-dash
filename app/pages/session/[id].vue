<script setup lang="ts">
import { pairToolResults, toLocalDisplayMessage } from "~/utils/chat-message";
import { getSessionStatus } from "~/composables/useHermes";
import type { DisplayMessage } from "~/types/hermes";
import type { UIMessage } from "ai";

const route = useRoute("/session/[id]");
const sessionId = route.params.id as string;

const { messages, session, pending, error, sessionError, isLive, refreshMessages, refreshSession } =
  useHermesSessionPolling(sessionId);

// Live chat over the gateway WebSocket (proxied through /ws). Polling stays
// as the backstop for history; the socket drives deltas + action state.
const {
  connected,
  running: wsRunning,
  streaming,
  sessionInfo,
  localMessages,
  statusLine,
  lastError,
  submit,
  steer,
  queue,
  interrupt,
  setModel,
} = useHermesChatSocket({ sessionId });

const input = ref("");

// While the socket is down, fall back to the polled liveness so Stop/Queue
// still appear on a live session.
const running = computed(() => wsRunning.value || (!connected.value && isLive.value));

const chatMessages = computed<DisplayMessage[]>(() => {
  const polled = messages.value?.messages || [];
  const existing = pairToolResults(polled);
  // Drop local entries the gateway already persisted (polling backstop) so
  // completed turns don't render twice.
  const local = localMessages.value.filter((m) => {
    if (!m.content) return true; // in-flight assistant message: keep streaming
    return !polled.some((p) => p.role === m.role && p.content === m.content);
  });
  return [...existing, ...local.map((m, i) => toLocalDisplayMessage(m, i))];
});

function handleSubmit(text: string) {
  input.value = "";
  submit(text);
}

function handleSteer(text: string) {
  input.value = "";
  steer(text);
}

function handleQueue(text: string) {
  input.value = "";
  queue(text);
}

function handleStop() {
  interrupt();
}

function handleModelChange(payload: { model?: string; provider?: string }) {
  if (payload.model && payload.provider) setModel(payload.model, payload.provider);
}
</script>

<template>
  <UDashboardPanel id="session-detail" class="min-h-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <Teleport to="#above-content">
        <SessionHeader
          :session="session"
          :pending="pending"
          @refresh="
            () => {
              refreshMessages();
              refreshSession();
            }
          "
        />
      </Teleport>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="pending" class="flex items-center gap-2 text-sm text-muted p-6">
        <UIcon name="i-lucide-loader-circle" class="animate-spin" />
        Loading messages...
      </div>

      <!-- Error state -->
      <div v-else-if="error || sessionError" class="text-sm text-error p-6">
        <UIcon name="i-lucide-alert-circle" class="shrink-0" />
        {{ error || sessionError }}
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
          :messages="chatMessages as UIMessage[]"
          :status="streaming || running || isLive ? 'streaming' : 'ready'"
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
            <SessionMessageContent
              :message="message as DisplayMessage"
              :chat-messages="chatMessages"
              :streaming="streaming"
              :is-live="isLive"
            />
          </template>

          <!-- Footer metadata for each message -->
          <template #actions="{ message }">
            <span
              v-if="(message as DisplayMessage).token_count"
              class="text-xs text-muted font-mono"
              >{{ (message as DisplayMessage).token_count }} tok</span
            >
            <span v-if="(message as DisplayMessage).finish_reason" class="text-xs text-muted"
              >— {{ (message as DisplayMessage).finish_reason }}</span
            >
          </template>

          <!-- Streaming indicator at bottom -->
          <template #indicator>
            <div class="flex items-center gap-1.5">
              <ChatIndicator />
            </div>
          </template>
        </UChatMessages>

        <!-- Gateway status / error lines -->
        <div class="px-6 text-xs">
          <div v-if="statusLine" class="text-muted truncate">{{ statusLine }}</div>
          <div v-if="lastError" class="text-error truncate">{{ lastError }}</div>
        </div>

        <!-- Chat prompt -->
        <div class="sticky bottom-0 mt-5">
          <ChatEditor
            v-model="input"
            :connected="connected"
            :running="running"
            :model="sessionInfo?.model"
            :provider="sessionInfo?.provider"
            @submit="handleSubmit"
            @steer="handleSteer"
            @stop="handleStop"
            @queue="handleQueue"
            @model-change="handleModelChange"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
