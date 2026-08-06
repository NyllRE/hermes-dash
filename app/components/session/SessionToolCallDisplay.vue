<script setup lang="ts">
import type { DisplayToolCall } from "~/types/hermes"
import { toolIcon } from "~/composables/useToolIcons"
import { getVisionArgs, parseToolArgs } from "~/utils/tool"

const props = defineProps<{
  toolCall: DisplayToolCall
  isLastMessage: boolean
  streaming: boolean
}>()

/** Known tool-result fields the template renders (rest stays unknown). */
interface ToolResultJson {
  [key: string]: unknown
  exit_code?: number
  success?: boolean
  output?: string
  error?: string
  content?: string
  total_lines?: number
  file_size?: number
}

/** Known tool-argument fields the template renders (rest stays unknown). */
interface ToolArgsJson {
  [key: string]: unknown
  command?: string
  timeout?: number
  pattern?: string
  path?: string
}

function getSuffix(tc: DisplayToolCall): string | undefined {
  if (!tc.function?.arguments) return
  const args = parseToolArgs(tc.function.arguments)
  if (!args) return
  return String(args.command ?? args.path ?? "")
}

const getName = (tc: DisplayToolCall): string | undefined => {
  const toolCallName = tc.function?.name || tc.name || tc.type
  return toolCallName?.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())
}

function parseResult(tc: DisplayToolCall): ToolResultJson | null {
  if (!tc.result) return null
  const text = tc.result
  try {
    return JSON.parse(text) as ToolResultJson
  } catch {
    const objEnd = text.lastIndexOf("}")
    const arrEnd = text.lastIndexOf("]")
    const end = Math.max(objEnd, arrEnd)
    if (end !== -1) {
      try {
        return JSON.parse(text.slice(0, end + 1)) as ToolResultJson
      } catch {
        /* truncated JSON — fall through */
      }
    }
    return null
  }
}
function parseArgs(tc: DisplayToolCall): ToolArgsJson | null {
  if (!tc.function?.arguments) return null
  try {
    return JSON.parse(tc.function.arguments) as ToolArgsJson
  } catch {
    return null
  }
}

function getTcvVisionArgs(tc: DisplayToolCall): ReturnType<typeof getVisionArgs> {
  return getVisionArgs(tc.function?.arguments)
}

function toolCallIcon(tc: DisplayToolCall): string {
  return toolIcon(tc.function?.name || tc.name || tc.type || "")
}

const searchResult = computed(() => parseResult(props.toolCall))
const searchFolder = computed(() => getSuffix(props.toolCall) || "")
const { searchTreeItems } = useSearchResult(searchResult, searchFolder)
</script>

<template>
  <UChatTool
    :text="getName(toolCall)"
    :default-open="streaming || isLastMessage"
    :icon="toolCallIcon(toolCall)"
    :suffix="getSuffix(toolCall)"
    variant="card"
    chevron="trailing"
    class="mb-1 w-full"
    unmount-on-hide
    :ui="{
      leadingIcon:
        parseResult(toolCall)?.exit_code === 0 || parseResult(toolCall)?.success
          ? 'text-success'
          : 'text-error',
      body: 'max-h-96 relative',
    }"
  >
    <ChatToolVision
      v-if="getTcvVisionArgs(toolCall)"
      :image-url="getTcvVisionArgs(toolCall)!.imageUrl"
      :question="getTcvVisionArgs(toolCall)!.question"
    />

    <div
      class="flex flex-col sm:flex-row gap-3 relative"
      v-else-if="toolCall.function?.name === 'terminal'"
    >
      <template v-if="parseArgs(toolCall) && parseResult(toolCall)">
        <ChatComark
          class="flex-1"
          :markdown="`\`\`\`bash\n$ ${parseArgs(toolCall)!.command}\n${parseResult(toolCall)!.output || parseResult(toolCall)!.error}\n\`\`\``"
        />
        <div class="flex flex-col h-min gap-3 sticky">
          <UBadge
            :label="`Timeout: ${parseArgs(toolCall)!.timeout}s`"
            variant="soft"
            color="info"
          />
          <UBadge
            :label="`exit_code: ${parseResult(toolCall)!.exit_code}`"
            variant="soft"
            :color="parseResult(toolCall)!.exit_code === 0 ? 'success' : 'error'"
          />
        </div>
      </template>
    </div>
    <div v-else-if="getName(toolCall) === 'Read File'" class="flex flex-col sm:flex-row gap-3">
      <template v-if="parseResult(toolCall)?.content">
        <ChatComark
          class="w-full"
          :markdown="`\`\`\`json\n${parseResult(toolCall)!.content}\n\`\`\``"
        />
        <div class="flex flex-col sticky top-0 h-min gap-2">
          <UBadge
            :label="`Total lines: ${(parseResult(toolCall)!.total_lines ?? 0) + 1}`"
            variant="soft"
            color="info"
          />
          <UBadge
            :label="`File size: ${((parseResult(toolCall)!.file_size ?? 0) / 1024).toFixed(2)} KB`"
            variant="soft"
            color="info"
          />
        </div>
      </template>
      <UAlert :title="`${getSuffix(toolCall)} doesn't exist`" color="error" variant="subtle" />
      <!-- <pre lang="json">{{ JSON.parse(toolCall.result) }}</pre> -->
    </div>
    <div v-else-if="getName(toolCall) === 'Search Files'" class="flex flex-col sm:flex-row gap-3">
      <div v-if="!!parseResult(toolCall)" class="flex-1">
        <UTree
          v-if="searchTreeItems.length > 0"
          :items="searchTreeItems"
        />
        <UAlert
          v-else-if="parseResult(toolCall)!.error"
          :title="parseResult(toolCall)!.error"
          color="error"
          variant="subtle"
        />
        <UAlert
          v-else
          :title="`No results found for '${parseArgs(toolCall)!.pattern}'`"
          color="error"
          variant="subtle"
        />
      </div>
    </div>
    <div v-else class="border-t border-default p-3 mt-3 rounded-md space-y-2 [&>h1]:text-muted">
      this tool call is not yet supported
    </div>
    <UCollapsible class="flex flex-col gap-2 w-full p-2">
      <UButton
        label="See Developer Details"
        color="neutral"
        variant="ghost"
        trailing-icon="i-lucide-chevron-down"
        block
      />
      <template #content>
        <pre lang="json" class="w-full p-1 rounded-sm ring ring-default overflow-x-auto">{{
          toolCall
        }}</pre>
      </template>
    </UCollapsible>
  </UChatTool>
</template>
