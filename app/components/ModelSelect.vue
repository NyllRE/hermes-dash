<script setup lang="ts">
// Real provider/model selector backed by the Hermes gateway.
// Options come from GET /api/hermes/model/options (proxied server-side);
// the selected pair is exposed via v-model for session.create.

interface ModelProviderInfo {
  slug: string
  name: string
  models: string[]
  authenticated: boolean
  auth_type?: string
  key_env?: string
  warning?: string
  capabilities?: Record<string, { fast: boolean, reasoning: boolean }>
}

interface ModelOptionsPayload {
  providers: ModelProviderInfo[]
  model: string
  provider: string
}

interface ModelOption {
  type: "item"
  label: string
  value: string
  provider: string
  icon?: string
}

// Flat item list: `type: 'label'` entries render as group headers in
// SelectMenu (Nuxt UI v4 flattens groups and renders ComboboxLabel for
// structural label items).
type ModelItem = { type: "label", label: string } | ModelOption

const selection = defineModel<{ model: string, provider: string } | null>({ default: null })

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "vscode-icons:file-type-claude",
  deepseek: "ri:deepseek-fill",
  openai: "logos:openai",
  google: "logos:google-icon",
  openrouter: "simple-icons:openrouter",
  moa: "i-lucide-layers",
  nous: "i-lucide-sparkles",
  copilot: "i-lucide-bot",
  xai: "i-lucide-bot"
}

function providerIcon(slug: string): string {
  return PROVIDER_ICONS[slug] ?? "i-lucide-cpu"
}

const modelsLoading = ref(true)
const modelsError = ref<string | null>(null)
const providers = ref<ModelProviderInfo[]>([])
const selectedModel = ref<ModelOption | undefined>(undefined)

const modelItems = computed<ModelItem[]>(() =>
  providers.value.flatMap(p => [
    { type: "label" as const, label: p.name },
    ...p.models.map(m => ({
      type: "item" as const,
      label: m,
      value: m,
      provider: p.slug,
      icon: providerIcon(p.slug)
    }))
  ])
)

// Pick the gateway's current model when it's offered, else the first
// authenticated provider's first model.
function resolveInitialOption(payload: ModelOptionsPayload): ModelOption | undefined {
  const rows = payload.providers.filter(p => p.authenticated && p.models.length > 0)
  const current = payload.model || ""
  const bare = current.includes("/") ? current.slice(current.indexOf("/") + 1) : current

  const byProvider = rows.find(p => p.slug === payload.provider)
  if (byProvider) {
    const exact = byProvider.models.find(m => m === current || m === bare)
    if (exact) {
      return {
        type: "item",
        label: exact,
        value: exact,
        provider: byProvider.slug,
        icon: providerIcon(byProvider.slug)
      }
    }
  }
  for (const p of rows) {
    const hit = p.models.find(m => m === current || m === bare)
    if (hit) {
      return { type: "item", label: hit, value: hit, provider: p.slug, icon: providerIcon(p.slug) }
    }
  }
  const first = rows[0]
  const firstModel = first?.models[0]
  if (first && firstModel) {
    return {
      type: "item",
      label: firstModel,
      value: firstModel,
      provider: first.slug,
      icon: providerIcon(first.slug)
    }
  }
  return undefined
}

async function loadModels() {
  modelsLoading.value = true
  modelsError.value = null
  try {
    const res = await fetch("/api/hermes/model/options", {
      credentials: "include",
      headers: { Accept: "application/json" }
    })
    if (!res.ok) throw new Error(`model options ${res.status}`)
    const payload = (await res.json()) as ModelOptionsPayload
    providers.value = payload.providers.filter(p => p.authenticated && p.models.length > 0)
    selectedModel.value = resolveInitialOption(payload)
  } catch (e: unknown) {
    modelsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    modelsLoading.value = false
  }
}

onMounted(loadModels)

watch(selectedModel, (option) => {
  selection.value = option ? { model: option.value, provider: option.provider } : null
})
</script>

<template>
  <USelectMenu
    v-model="selectedModel"
    :items="modelItems"
    :icon="selectedModel?.icon"
    :disabled="modelsLoading"
    :loading="modelsLoading"
    :placeholder="modelsError || 'Model'"
    size="sm"
    variant="ghost"
    class="w-fit"
    :ui="{
      trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
    }"
  />
</template>
