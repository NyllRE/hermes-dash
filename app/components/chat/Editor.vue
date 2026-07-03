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

const value = ref(`# Drag Handle

Hover over the left side of this block to see the drag handle appear and reorder blocks.`);

// SSR-safe function to append menus to body (avoids z-index issues in docs)
const appendToBody = import.meta.client ? () => document.body : undefined;

const models = ref([
  {
    value: "claude-fable-5",
    label: "Claude Fable 5",
    icon: "vscode-icons:file-type-claude",
  },
  {
    value: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    icon: "ri:deepseek-fill",
  },
  {
    value: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    icon: "ri:deepseek-fill",
  },
]);
const selectedModel = ref(models.value[0]);
</script>

<template>
  <div
    class="w-[calc(100%-2rem)] flex flex-col gap-5 items-end relative m-4 p-4 bg-default/80 backdrop-blur-md rounded-xl shadow ring ring-default"
  >
    <UScrollArea class="max-h-72 flex-1 w-full">
      <UEditor
        v-slot="{ editor }"
        text-direction="auto"
        v-model="value"
        content-type="markdown"
        class="w-full min-h-21"
        inject-c-s-s
        :starter-kit="{
          codeBlock: false,
          headings: {
            levels: [1, 2, 3, 4],
          },
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
    <div class="flex gap-3 mt-5">
      <USelectMenu
        size="sm"
        v-model="selectedModel"
        :icon="selectedModel.icon"
        :items="models"
        class="w-fit"
      />
      <UChatPromptSubmit size="sm" />
    </div>
  </div>
</template>
