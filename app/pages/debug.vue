<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui"
import type { HermesSession } from "~/types/hermes"
import { formatDistanceToNow } from "date-fns"

const {
  data: status,
  pending: statusPending,
  error: statusError,
  refresh: refreshStatus
} = useHermesStatus()
const {
  data: model,
  pending: modelPending,
  error: modelError,
  refresh: refreshModel
} = useHermesModel()
const {
  data: sessions,
  pending: sessionsPending,
  error: sessionsError,
  refresh: refreshSessions
} = useHermesSessions(10)

function refreshAll() {
  refreshStatus()
  refreshModel()
  refreshSessions()
}

const platformList = computed(() => {
  if (!status.value?.gateway_platforms) return []
  return Object.entries(status.value.gateway_platforms).map(([key, val]) => ({
    name: key,
    display: val.display_name ?? key,
    connected: val.connected
  }))
})

const gatewayBadgeColor = computed(() => {
  const s = status.value?.gateway_state
  if (s === "running") return "success" as const
  if (s && ["starting", "draining"].includes(s)) return "warning" as const
  return "neutral" as const
})

const sessionColumns: TableColumn<HermesSession>[] = [
  { accessorKey: "id", header: "ID", minSize: 140 },
  { accessorKey: "source", header: "Source", minSize: 100 },
  { accessorKey: "title", header: "Title", minSize: 220 },
  { accessorKey: "is_active", header: "Is Active", minSize: 110 },
  { accessorKey: "message_count", header: "Messages", minSize: 100 },
  { accessorKey: "preview", header: "Preview", minSize: 300 },
  { accessorKey: "model", header: "Model", minSize: 200 },
  { accessorKey: "started_at", header: "Started", minSize: 120 },
  { accessorKey: "last_active", header: "Last Active", minSize: 160 },
  { accessorKey: "ended_at", header: "Ended", minSize: 120 },
  { accessorKey: "archived", header: "Archived", minSize: 100 }
]
</script>

<template>
  <UDashboardPanel id="debug" class="min-h-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <Navbar>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-ccw"
          :disabled="statusPending"
          aria-label="Refresh"
          @click="refreshAll"
        />
      </Navbar>
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col gap-6 py-8">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-highlighted">Debug</h1>
          <span class="text-xs text-muted font-mono">Hermes Dashboard API</span>
        </div>

        <!-- ──────── Gateway Status ──────── -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm">Gateway</span>
              <UBadge
                v-if="status"
                :label="status.gateway_state ?? 'unknown'"
                :color="gatewayBadgeColor"
                variant="subtle"
                size="sm"
              />
            </div>
          </template>

          <div v-if="statusPending" class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
            Loading...
          </div>

          <div v-else-if="statusError" class="text-sm text-error">
            <UIcon name="i-lucide-alert-circle" class="shrink-0" />
            {{ statusError }}
          </div>

          <div v-else-if="status" class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p class="text-muted text-xs uppercase tracking-wider">Version</p>
              <p class="font-mono mt-0.5">{{ status.version || "—" }}</p>
            </div>
            <div>
              <p class="text-muted text-xs uppercase tracking-wider">Active Sessions</p>
              <p class="font-mono mt-0.5">{{ status.active_sessions }}</p>
            </div>
            <div>
              <p class="text-muted text-xs uppercase tracking-wider">Active Agents</p>
              <p class="font-mono mt-0.5">{{ status.active_agents }}</p>
            </div>
          </div>

          <!-- Platforms -->
          <template v-if="platformList.length" #footer>
            <div class="text-xs space-y-1">
              <p class="text-muted uppercase tracking-wider mb-1">Platforms</p>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="p in platformList"
                  :key="p.name"
                  :label="p.display"
                  :color="p.connected ? 'success' : 'neutral'"
                  :variant="p.connected ? 'solid' : 'subtle'"
                  size="sm"
                />
              </div>
            </div>
          </template>
        </UCard>

        <!-- ──────── Model Info ──────── -->
        <UCard>
          <template #header>
            <span class="font-semibold text-sm">Model</span>
          </template>

          <div v-if="modelPending" class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
            Loading...
          </div>

          <div v-else-if="modelError" class="text-sm text-error">
            <UIcon name="i-lucide-alert-circle" class="shrink-0" />
            {{ modelError }}
          </div>

          <div v-else-if="model" class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p class="text-muted text-xs uppercase tracking-wider">Provider</p>
              <p class="font-mono mt-0.5">{{ model.provider || "—" }}</p>
            </div>
            <div>
              <p class="text-muted text-xs uppercase tracking-wider">Model</p>
              <p class="font-mono mt-0.5 break-all">{{ model.model || "—" }}</p>
            </div>
            <div>
              <p class="text-muted text-xs uppercase tracking-wider">Context Length</p>
              <p class="font-mono mt-0.5">
                {{ model.effective_context_length?.toLocaleString() || "—" }}
              </p>
            </div>
          </div>
        </UCard>

        <!-- ──────── Recent Sessions ──────── -->
        <UCard :ui="{ body: 'p-0' }">
          <template #header>
            <span class="font-semibold text-sm">Recent Sessions ({{ sessions?.total ?? 0 }})</span>
          </template>

          <div v-if="sessionsPending" class="flex items-center gap-2 text-sm text-muted p-4">
            <UIcon name="i-lucide-loader-circle" class="animate-spin" />
            Loading...
          </div>

          <div v-else-if="sessionsError" class="text-sm text-error p-4">
            <UIcon name="i-lucide-alert-circle" class="shrink-0" />
            {{ sessionsError }}
          </div>

          <div v-else-if="sessions?.sessions.length" class="overflow-x-auto">
            <UTable
              :data="sessions.sessions"
              :columns="sessionColumns"
              class="w-full"
              :ui="{
                td: 'py-2.5 px-3.5 text-sm',
                th: 'font-semibold text-xs text-muted uppercase tracking-wider px-3.5 py-3 whitespace-nowrap',
              }"
            >
              <template #id-cell="{ row }">
                <span class="font-mono text-xs">{{ row.original.id?.slice(0, 12) }}…</span>
              </template>

              <template #source-cell="{ row }">
                <UBadge
                  :label="row.original.source"
                  size="sm"
                  variant="subtle"
                  color="neutral"
                />
              </template>

              <template #title-cell="{ row }">
                <UTooltip :text="row.original.title || 'Untitled'" class="block min-w-0">
                  <span class="truncate block text-sm font-medium">{{
                    row.original.title || "Untitled"
                  }}</span>
                </UTooltip>
              </template>

              <template #is_active-cell="{ row }">
                <UBadge
                  :label="row.original.is_active ? 'Active' : 'Inactive'"
                  :color="row.original.is_active ? 'success' : 'neutral'"
                  variant="soft"
                  size="sm"
                />
              </template>

              <template #message_count-cell="{ row }">
                <span class="font-mono text-sm font-semibold">{{
                  row.original.message_count
                }}</span>
              </template>

              <template #preview-cell="{ row }">
                <UTooltip
                  v-if="row.original.preview"
                  :text="row.original.preview"
                  class="block min-w-0"
                >
                  <span class="truncate block text-xs text-muted">{{
                    row.original.preview
                  }}</span>
                </UTooltip>
                <span v-else class="text-muted text-xs">—</span>
              </template>

              <template #model-cell="{ row }">
                <UTooltip
                  v-if="row.original.model"
                  :text="row.original.model"
                  class="block min-w-0"
                >
                  <span class="truncate block font-mono text-xs">{{
                    row.original.model
                  }}</span>
                </UTooltip>
                <span v-else class="text-muted text-xs">—</span>
              </template>

              <template #started_at-cell="{ row }">
                <span class="font-mono text-xs whitespace-nowrap">
                  {{ new Date(row.original.started_at * 1000).toLocaleDateString() }}
                </span>
              </template>

              <template #last_active-cell="{ row }">
                <UTooltip
                  :text="new Date(row.original.last_active * 1000).toLocaleString()"
                >
                  <span class="font-mono text-xs whitespace-nowrap text-muted">
                    {{
                      formatDistanceToNow(row.original.last_active * 1000, {
                        addSuffix: true,
                      })
                    }}
                  </span>
                </UTooltip>
              </template>

              <template #ended_at-cell="{ row }">
                <span
                  v-if="row.original.ended_at"
                  class="font-mono text-xs whitespace-nowrap text-muted"
                >
                  {{ new Date(row.original.ended_at * 1000).toLocaleDateString() }}
                </span>
                <span v-else class="text-muted text-xs">—</span>
              </template>

              <template #archived-cell="{ row }">
                <UBadge
                  :label="row.original.archived ? 'Yes' : 'No'"
                  :color="row.original.archived ? 'warning' : 'neutral'"
                  variant="soft"
                  size="sm"
                />
              </template>
            </UTable>
          </div>

          <div v-else class="text-sm text-muted p-4">No sessions found.</div>
        </UCard>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
