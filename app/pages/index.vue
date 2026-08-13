<script setup lang="ts">
import { getSessionStatus } from "~/composables/useHermes"

const { user } = useUserSession()

const greeting = computed(() => {
  const hour = new Date().getHours()
  let timeGreeting = "Good evening"
  if (hour < 12) timeGreeting = "Good morning"
  else if (hour < 18) timeGreeting = "Good afternoon"

  const name = user.value?.name?.split(" ")[0] || user.value?.username

  return name ? `${timeGreeting}, ${name}` : `${timeGreeting}`
})

const { data: sessions, pending, error } = useHermesSessions(5)

const recentSessions = computed(() => sessions.value?.sessions ?? [])

// ── Start a real Hermes session from the landing prompt ────────────────
// Submitting no longer touches the legacy /api/chats records: it creates a
// genuine gateway session over /ws (session.create with the selected real
// model/provider), submits the prompt into it, then routes to the live
// session viewer at /session/<stored_session_id>.
const input = ref("")
const submitting = ref(false)
const submitError = ref<string | null>(null)
const modelChoice = ref<{ model: string, provider: string } | null>(null)

const gateway = useHermesChatSocket()

async function startSession(prompt: string) {
  const text = prompt.trim()
  if (!text || submitting.value) return
  if (!gateway.connected.value || !gateway.ready.value) {
    submitError.value = "Gateway not connected — try again in a moment."
    return
  }
  submitting.value = true
  submitError.value = null
  try {
    const created = await gateway.createSessionAsync(
      modelChoice.value?.model,
      modelChoice.value?.provider
    )
    input.value = text
    gateway.submit(text)
    // The turn keeps running on the gateway after this socket closes
    // (verified: prompt.submit is flushed before navigation, the session
    // viewer re-attaches via session.resume + polling).
    navigateTo(`/session/${created.stored_session_id}`)
  } catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

function onSubmit() {
  startSession(input.value)
}

const quickChats = [
  {
    label: "Why use Nuxt UI?",
    icon: "i-logos-nuxt-icon"
  },
  {
    label: "Help me create a Vue composable",
    icon: "i-logos-vue"
  },
  {
    label: "Tell me more about UnJS",
    icon: "i-logos-unjs"
  },
  {
    label: "Why should I consider VueUse?",
    icon: "i-logos-vueuse"
  },
  {
    label: "Tailwind CSS best practices",
    icon: "i-logos-tailwindcss-icon"
  },
  {
    label: "What is the weather in Bordeaux?",
    icon: "i-lucide-sun"
  },
  {
    label: "Show me a chart of sales data",
    icon: "i-lucide-line-chart"
  }
]
</script>

<template>
  <UDashboardPanel id="home" class="min-h-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <Navbar />
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col justify-center gap-6 py-8">
        <div class="flex flex-col gap-2">
          <h1 class="text-3xl sm:text-4xl text-highlighted font-bold">
            {{ greeting }}
          </h1>
          <p class="text-muted">
            Ask Hermes anything — a live session starts on the gateway with the model you pick.
          </p>
        </div>

        <UChatPrompt
          v-model="input"
          :status="submitting ? 'streaming' : 'ready'"
          class="[view-transition-name:chat-prompt]"
          variant="subtle"
          :ui="{ base: 'px-1.5' }"
          @submit="onSubmit"
        >
          <template #footer>
            <div class="flex items-center gap-1">
              <ModelSelect v-model="modelChoice" />
            </div>

            <UChatPromptSubmit
              color="neutral"
              size="sm"
              :disabled="submitting || !gateway.connected.value"
            />
          </template>
        </UChatPrompt>

        <div v-if="submitError" class="text-sm text-error flex items-center gap-2">
          <UIcon name="i-lucide-alert-circle" class="shrink-0" />
          {{ submitError }}
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="quickChat in quickChats"
            :key="quickChat.label"
            :icon="quickChat.icon"
            :label="quickChat.label"
            size="sm"
            color="neutral"
            variant="outline"
            class="rounded-full"
            @click="startSession(quickChat.label)"
          />
        </div>

        <div v-if="recentSessions.length" class="flex flex-col gap-1.5">
          <NuxtLink
            v-for="s in recentSessions"
            :key="s.id"
            :to="`/session/${s.id}`"
            class="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accented/50 transition-colors"
          >
            <UIcon
              :name="getSessionStatus(s).icon || 'i-lucide-terminal'"
              class="shrink-0"
            />
            <span class="truncate">{{ s.title || s.preview || "Untitled" }}</span>
            <UBadge
              :label="getSessionStatus(s).label"
              :color="getSessionStatus(s).color"
              size="sm"
              variant="soft"
              class="ms-auto shrink-0"
            />
          </NuxtLink>
        </div>

        <div v-else-if="pending" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="animate-spin" />
          Loading sessions...
        </div>
        <div v-else-if="error" class="text-sm text-error flex items-center gap-2">
          <UIcon name="i-lucide-alert-circle" class="shrink-0" />
          {{ error }}
        </div>

        <UButton
          to="/debug"
          icon="i-lucide-bug"
          label="Gateway status"
          color="neutral"
          variant="outline"
          size="sm"
          class="w-fit rounded-full"
        />
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
