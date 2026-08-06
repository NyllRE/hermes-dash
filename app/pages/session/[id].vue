<script setup lang="ts">
import { pairToolResults, toLocalDisplayMessage } from "~/utils/chat-message"
import { getSessionStatus } from "~/composables/useHermes"
import type { DisplayMessage } from "~/types/hermes"
import type { UIMessage } from "ai"

const route = useRoute("/session/[id]")
const sessionId = route.params.id as string

const { messages, session, pending, error, isLive, refreshMessages, refreshSession }
  = useHermesSessionPolling(sessionId)

const { streaming, localMessages, send: sendMessage } = useHermesChatSend(messages)

const input = ref("")

const chatMessages = computed<DisplayMessage[]>(() => {
  const existing = pairToolResults(messages.value?.messages || [])
  const local = localMessages.value.map((m, i) => toLocalDisplayMessage(m, i))
  return [...existing, ...local]
})

function handleSend() {
  const text = input.value.trim()
  if (!text) return
  input.value = ""
  sendMessage(text)
}
</script>

<template>
  <UDashboardPanel id="session-detail" class="min-h-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <SessionHeader
        :session="session"
        :pending="pending"
        @refresh="refreshMessages(undefined) || refreshSession(undefined)"
      />
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
          :messages="chatMessages as UIMessage[]"
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
            <SessionMessageContent
              :message="message as DisplayMessage"
              :chat-messages="chatMessages"
              :streaming="streaming"
              :is-live="isLive"
            />
          </template>

          <!-- Footer metadata for each message -->
          <template #actions="{ message }">
            <span v-if="(message as DisplayMessage).token_count" class="text-xs text-muted font-mono"
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
              <UChatShimmer text="Thinking..." class="text-sm" />
            </div>
          </template>
        </UChatMessages>

        <!-- Chat prompt -->
        <div class="sticky bottom-0 mt-5">
          <ChatEditor />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
