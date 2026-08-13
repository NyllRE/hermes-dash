<script setup lang="ts">
const { loggedIn, openInPopup } = useUserSession()

const sidebarOpen = ref(false)

// ── Hermes sessions sidebar ──
const { data: hermesSessions, refresh: refreshHermes } = useHermesSessions(50)

const sessionSearch = ref("")

const filteredSessions = computed(() => {
  if (!hermesSessions.value?.sessions) return []
  const q = sessionSearch.value.toLowerCase().trim()
  if (!q) return []
  return hermesSessions.value.sessions.filter(
    s => s.title?.toLowerCase().includes(q) || s.preview?.toLowerCase().includes(q)
  )
})

const hermesNavItems = computed(() => {
  const source = sessionSearch.value ? filteredSessions.value : hermesSessions.value?.sessions
  if (!source?.length) return []
  return source.map((s) => {
    const status = getSessionStatus(s)
    return {
      label: s.title || s.preview || "Untitled",
      to: `/session/${s.id}`,
      icon: "i-lucide-terminal",
      class: [!s.title ? "text-muted" : "", status.label === "ended" ? "opacity-60" : ""]
        .filter(Boolean)
        .join(" "),
      badge: status
    }
  })
})

onNuxtReady(() => {
  refreshHermes()
})

watch(loggedIn, () => {
  refreshHermes()
  sidebarOpen.value = false
})

// Auto-refresh Hermes sessions every 30s so new sessions appear in the sidebar
let refreshInterval: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  refreshInterval = setInterval(() => refreshHermes(), 30000)
})
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

// Also refresh when navigating to a new route (new session might have been created)
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    refreshHermes()
  }
)

defineShortcuts({
  meta_o: () => {
    navigateTo("/")
  }
})
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      id="default"
      v-model:open="sidebarOpen"
      :min-size="12"
      collapsible
      resizable
      :menu="{ inset: true }"
      class="border-r-0 py-4 dark:[--ui-bg-elevated:var(--ui-color-neutral-900)]"
    >
      <template #header="{ collapsed }">
        <NuxtLink v-if="!collapsed" to="/" class="flex items-center gap-2">
          <img src="/Logo.svg" class="h-10 w-auto shrink-0" />
          <div class="flex flex-col items-start gap-0">
            <span class="text-xl font-bold text-highlighted">Hermes Aroma</span>
            <span class="text-xs text-muted flex items-center gap-1"
              >By
              <img class="w-15" src="https://redeast.agency/RedEast.white.svg" alt="RedEast Logo"
            /></span>
          </div>
        </NuxtLink>

        <UDashboardSidebarCollapse class="ms-auto" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="[
            {
              label: 'Home',
              to: '/',
              kbds: ['meta', 'o'],
              icon: 'i-lucide-house',
            },
            {
              label: 'Debug',
              to: '/debug',
              icon: 'i-lucide-bug',
            },
          ]"
          :collapsed="collapsed"
          orientation="vertical"
        >
          <template #item-trailing="{ item }">
            <div
              v-if="item.kbds?.length"
              class="flex items-center gap-px opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <UKbd
                v-for="kbd in item.kbds"
                :key="kbd"
                :value="kbd"
                size="sm"
                variant="soft"
                class="bg-accented/50"
              />
            </div>
          </template>
        </UNavigationMenu>

        <USeparator v-if="!collapsed && hermesSessions?.sessions?.length" class="my-1" />

        <div v-if="!collapsed && hermesSessions?.sessions?.length" class="px-3 pb-1">
          <UInput
            v-model="sessionSearch"
            placeholder="Search sessions..."
            icon="i-lucide-search"
            color="neutral"
            variant="subtle"
            size="sm"
            @click.stop
          />
        </div>

        <UNavigationMenu
          v-if="!collapsed && hermesNavItems.length"
          :items="hermesNavItems"
          :collapsed="collapsed"
          orientation="vertical"
          :ui="{
            link: 'overflow-hidden',
          }"
        >
          <template #item-trailing="{ item }">
            <UIcon
              v-if="item.badge?.icon"
              :name="item.badge.icon"
              :class="{
                'text-(--ui-success)': item.badge.color === 'success',
                'text-(--ui-warning)': item.badge.color === 'warning',
                'text-(--ui-info)': item.badge.color === 'info',
                'text-muted': item.badge.color === 'neutral',
              }"
            />
          </template>
        </UNavigationMenu>
      </template>

      <template #footer="{ collapsed }">
        <UserMenu v-if="loggedIn" :collapsed="collapsed" />
        <UButton
          v-else
          :label="collapsed ? '' : 'Login with GitHub'"
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          class="w-full"
          @click="openInPopup('/auth/github')"
        />
      </template>
    </UDashboardSidebar>

    <div class="flex-1 min-w-0 flex flex-col lg:ml-0 mr-3">
      <div id="above-content" />
      <div
        class="flex rounded-xl my-3 p-2 ring ring-default bg-default/75 shadow min-w-0 h-full overflow-hidden w-full"
      >
        <slot />
      </div>
    </div>
  </UDashboardGroup>
</template>
