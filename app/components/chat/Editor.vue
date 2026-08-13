<script setup lang="ts">
import { icon } from "#build/ui/prose";
import type { EditorSuggestionMenuItem } from "@nuxt/ui";
import { Emoji } from "@tiptap/extension-emoji";
import { TextAlign } from "@tiptap/extension-text-align";
import { CodeBlockShiki } from "tiptap-extension-code-block-shiki";

const items: EditorSuggestionMenuItem[][] = [
  [
    {
      type: "label",
      label: "Text",
    },
    {
      kind: "paragraph",
      label: "Paragraph",
      icon: "i-lucide-type",
    },
    {
      kind: "heading",
      level: 1,
      label: "Heading 1",
      icon: "i-lucide-heading-1",
    },
    {
      kind: "heading",
      level: 2,
      label: "Heading 2",
      icon: "i-lucide-heading-2",
    },
    {
      kind: "heading",
      level: 3,
      label: "Heading 3",
      icon: "i-lucide-heading-3",
    },
  ],
  [
    {
      type: "label",
      label: "Lists",
    },
    {
      kind: "bulletList",
      label: "Bullet List",
      icon: "i-lucide-list",
    },
    {
      kind: "orderedList",
      label: "Numbered List",
      icon: "i-lucide-list-ordered",
    },
  ],
  [
    {
      type: "label",
      label: "Insert",
    },
    {
      kind: "blockquote",
      label: "Blockquote",
      icon: "i-lucide-text-quote",
    },
    {
      kind: "codeBlock",
      label: "Code Block",
      icon: "i-lucide-square-code",
    },
    {
      kind: "horizontalRule",
      label: "Divider",
      icon: "i-lucide-separator-horizontal",
    },
  ],
];

const value = defineModel<string>({ default: "" });

// SSR-safe function to append menus to body (avoids z-index issues in docs)
const appendToBody = import.meta.client ? () => document.body : undefined;

const props = defineProps<{
  connected?: boolean;
  running?: boolean;
  /** Session's actual model/provider (from session.info) — syncs the selector. */
  model?: string;
  provider?: string;
}>();

const emit = defineEmits<{
  submit: [text: string];
  steer: [text: string];
  stop: [];
  queue: [text: string];
  modelChange: [payload: { model?: string; provider?: string }];
}>();

// ── Model selector (real providers/models from the Hermes gateway) ─────

interface ModelProviderInfo {
  slug: string;
  name: string;
  models: string[];
  total_models: number;
  authenticated: boolean;
  auth_type?: string;
  key_env?: string;
  warning?: string;
  capabilities?: Record<string, { fast: boolean; reasoning: boolean }>;
}

interface ModelOptionsPayload {
  providers: ModelProviderInfo[];
  model: string;
  provider: string;
}

interface ModelOption {
  type: "item";
  label: string;
  value: string;
  provider: string;
  icon?: string;
}

// Flat item list: `type: 'label'` entries render as group headers in
// SelectMenu (Nuxt UI v4 flattens groups and renders ComboboxLabel for
// structural label items).
type ModelItem = { type: "label"; label: string } | ModelOption;

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "vscode-icons:file-type-claude",
  deepseek: "ri:deepseek-fill",
  openai: "logos:openai",
  google: "logos:google-icon",
  openrouter: "simple-icons:openrouter",
  moa: "i-lucide-layers",
};

function providerIcon(slug: string): string {
  return PROVIDER_ICONS[slug] ?? "i-lucide-cpu";
}

const modelsLoading = ref(true);
const modelsError = ref<string | null>(null);
const providers = ref<ModelProviderInfo[]>([]);
const selectedModel = ref<ModelOption | undefined>(undefined);

// The user interacted with the picker — stop syncing from session.info.
const userTouched = ref(false);

const modelItems = computed<ModelItem[]>(() =>
  providers.value.flatMap((p) => [
    { type: "label" as const, label: p.name },
    ...p.models.map((m) => ({
      type: "item" as const,
      label: m,
      value: m,
      provider: p.slug,
      icon: providerIcon(p.slug),
    })),
  ]),
);

function findOption(model: string, provider: string): ModelOption | undefined {
  for (const item of modelItems.value) {
    if (item.type === "label") continue;
    if (item.value === model && item.provider === provider) return item;
  }
  return undefined;
}

function resolveInitialOption(payload: ModelOptionsPayload): ModelOption | undefined {
  const rows = payload.providers.filter((p) => p.authenticated && p.models.length > 0);
  const current = payload.model || "";
  const bare = current.includes("/") ? current.slice(current.indexOf("/") + 1) : current;

  // Prefer the current provider's row, then any row carrying the model.
  const byProvider = rows.find((p) => p.slug === payload.provider);
  if (byProvider) {
    const exact = byProvider.models.find((m) => m === current || m === bare);
    if (exact)
      return {
        type: "item",
        label: exact,
        value: exact,
        provider: byProvider.slug,
        icon: providerIcon(byProvider.slug),
      };
  }
  for (const p of rows) {
    const hit = p.models.find((m) => m === current || m === bare);
    if (hit)
      return { type: "item", label: hit, value: hit, provider: p.slug, icon: providerIcon(p.slug) };
  }
  const first = rows[0];
  const firstModel = first?.models[0];
  if (first && firstModel) {
    return {
      type: "item",
      label: firstModel,
      value: firstModel,
      provider: first.slug,
      icon: providerIcon(first.slug),
    };
  }
  return undefined;
}

async function loadModels() {
  modelsLoading.value = true;
  modelsError.value = null;
  try {
    const res = await fetch("/api/hermes/model/options", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`model options ${res.status}`);
    const payload = (await res.json()) as ModelOptionsPayload;
    providers.value = payload.providers.filter((p) => p.authenticated && p.models.length > 0);
    // The session's own model wins over the profile default when present.
    const initial =
      (!userTouched.value && props.model && props.provider
        ? findOption(props.model, props.provider)
        : null) ?? resolveInitialOption(payload);
    if (initial) selectedModel.value = initial;
  } catch (e: unknown) {
    modelsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    modelsLoading.value = false;
  }
}

onMounted(loadModels);

// Sync the selector to the session's live model (session.info) until the
// user picks something themselves.
watch(
  () => [props.model, props.provider] as const,
  ([model, provider]) => {
    if (userTouched.value || !model || !provider) return;
    const option = findOption(model, provider);
    if (option && selectedModel.value?.value !== option.value) {
      selectedModel.value = option;
    }
  },
);

watch(selectedModel, (option) => {
  emit("modelChange", {
    model: option?.value,
    provider: option?.provider,
  });
});

// ── Actions ────────────────────────────────────────────────────────────

function handleSubmit() {
  const text = value.value.trim();
  if (!text) return;
  if (props.running) emit("steer", text);
  else emit("submit", text);
}

function handleQueue() {
  const text = value.value.trim();
  if (!text) return;
  emit("queue", text);
}
</script>

<template>
  <form
    class="w-[calc(100%-2rem)] flex flex-col overflow-hidden gap-2 items-end relative m-1 p-2 bg-default/80 backdrop-blur-md rounded-sm shadow ring ring-default"
    @submit.prevent="handleSubmit"
  >
    <UScrollArea shadow class="max-h-72 flex-1 w-full">
      <UEditor
        v-slot="{ editor }"
        v-model="value"
        placeholder="Describe what you need..."
        text-direction="auto"
        editable
        content-type="markdown"
        class="w-full min-h-7 gap-1"
        inject-c-s-s
        :ui="{
          base: '[&_p]:my-1 [&_p]:leading-5 [&_:is(h1,h2,h3,h4,h5,h6)]:my-2 [&_:is(ul,ol)]:my-2',
        }"
        :starter-kit="{
          codeBlock: false,
          link: {
            openOnClick: false,
          },
        }"
        :extensions="[
          Emoji,
          TextAlign.configure({ types: ['heading', 'paragraph'] }),
          CodeBlockShiki,
        ]"
      >
        <UEditorDragHandle :editor="editor" />
        <UEditorSuggestionMenu :editor="editor" :items="items" :append-to="appendToBody" />
      </UEditor>
    </UScrollArea>
    <div
      class="flex gap-3 absolute bottom-0 end-3 opacity-10 saturate-50 translate-y-5 hover:translate-y-0 pb-2 hover:opacity-100 hover:saturate-100 transition-all duration-200 items-start"
    >
      <template v-if="running">
        <UButton
          size="sm"
          color="error"
          variant="soft"
          icon="i-lucide-square"
          :disabled="!connected"
          aria-label="Stop"
          @click="emit('stop')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          icon="i-lucide-list-plus"
          :disabled="!connected || !value.trim()"
          aria-label="Queue"
          @click="handleQueue"
        />
      </template>
      <USelectMenu
        size="sm"
        v-model="selectedModel"
        :items="modelItems"
        :icon="selectedModel?.icon"
        :disabled="!connected || modelsLoading"
        :loading="modelsLoading"
        :placeholder="modelsError || 'Model'"
        class="w-fit"
        @change="userTouched = true"
      />
      <UChatPromptSubmit
        size="sm"
        :label="running ? 'Steer' : 'Send'"
        :icon="running ? 'i-lucide-corner-up-left' : undefined"
        :disabled="!connected || !value.trim()"
      />
    </div>
  </form>
</template>
