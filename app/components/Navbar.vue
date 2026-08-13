<template>
  <UDashboardNavbar
    class="w-full h-min inset-x-0 border-b-0 z-10 pointer-events-none pt-2 sm:px-2"
    :ui="{ left: 'pointer-events-auto min-w-0', right: 'pointer-events-auto' }"
  >
    <template #left>
      <slot name="title" />
    </template>

    <template #right>
      <slot />

      <UColorModeButton />

      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-circle-plus"
        to="/"
        class="lg:hidden"
        aria-label="New chat"
      />
    </template>
  </UDashboardNavbar>
</template>
