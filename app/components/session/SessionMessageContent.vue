<script setup lang="ts">
import type { DisplayMessage } from "~/types/hermes"
import { toolIcon } from "~/composables/useToolIcons"

const props = defineProps<{
  message: DisplayMessage
  chatMessages: DisplayMessage[]
  streaming: boolean
  isLive: boolean | undefined
}>()

const isLastMessage = computed(
  () => props.message.id === props.chatMessages[props.chatMessages.length - 1]?.id
)
</script>

<template>
  <!-- Reasoning -->
  <UChatReasoning
    v-if="message.reasoning_content"
    :text="message.reasoning_content"
    :streaming="streaming || isLastMessage"
    :shimmer="{ spread: 1.5, duration: 1 }"
    :icon="streaming || (isLive && isLastMessage) ? 'svg-spinners:bars-fade' : 'ri:brain-ai-3-fill'"
    class="mb-2"
    :auto-close-delay="500"
    unmount-on-hide
    :ui="{
      trigger: '[&>.iconify]:opacity-0 hover:[&>.iconify]:opacity-100',
    }"
  >
    <ChatComark class="h-full" :markdown="message.reasoning_content" />
  </UChatReasoning>

  <!-- Tool calls -->
  <template v-if="message.tool_calls?.length">
    <SessionToolCallDisplay
      v-for="(tc, tcIndex) in message.tool_calls"
      :key="`${message.id}-tc-${tcIndex}`"
      :tool-call="tc"
      :is-last-message="isLastMessage"
      :streaming="streaming"
    />
  </template>

  <!-- Tool results -->
  <template v-else-if="message.role === 'tool'">
    <UChatTool
      :text="message.tool_name || message.tool_call_id || 'Tool'"
      icon="i-lucide-bolt"
      variant="inline"
      chevron="trailing"
      class="mb-1"
    >
      <pre class="text-xs text-muted overflow-x-auto whitespace-pre-wrap">{{
        message.content
      }}</pre>
    </UChatTool>
  </template>

  <!-- Assistant text -->
  <ChatComark
    v-else-if="message.role === 'assistant' && message.content"
    :markdown="message.content"
  />

  <!-- User text -->
  <p v-else-if="message.role === 'user'" class="whitespace-pre-wrap">
    {{ message.content || "" }}
  </p>
</template>
