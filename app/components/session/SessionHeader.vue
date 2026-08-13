<script setup lang="ts">
import type { HermesSession } from "~/types/hermes";
import { getSessionStatus } from "~/composables/useHermes";

defineProps<{
  session?: HermesSession | null;
  pending?: boolean;
}>();

defineEmits<{
  refresh: [];
}>();
</script>

<template>
  <Navbar>
    <template #title>
      <span class="text-lg font-semibold truncate">{{
        session?.title || session?.preview || "Session"
      }}</span>
    </template>
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-refresh-ccw"
      :disabled="pending"
      aria-label="Refresh"
      @click="$emit('refresh')"
    />
  </Navbar>
</template>
