<script setup lang="ts">
const props = defineProps<{
  imageUrl: string;
  question: string;
}>();

const servedUrl = computed(() => fileUrlToServed(props.imageUrl));
const imageLoading = ref(true);
const imageError = ref(false);
const showModal = ref(false);

function openModal() {
  if (!imageError.value) showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}
</script>

<template>
  <div class="flex items-start gap-4 my-4">
    <div
      class="relative size-28 shrink-0 rounded-lg overflow-hidden border border-default bg-muted cursor-pointer"
      @click="openModal"
    >
      <div
        v-if="imageLoading && !imageError"
        class="flex items-center justify-center size-full bg-muted/50"
      >
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>
      <img
        v-show="!imageError"
        :src="servedUrl"
        alt="Analysis image"
        class="size-full object-cover"
        :class="[imageLoading && 'invisible absolute']"
        @load="imageLoading = false"
        @error="
          imageError = true;
          imageLoading = false;
        "
      />
      <div
        v-if="imageError"
        class="flex flex-col items-center justify-center gap-1 size-full text-muted text-xs"
      >
        <UIcon name="i-lucide-image-off" class="size-4" />
        <span>No image</span>
      </div>
    </div>
    <div class="text-sm text-foreground leading-relaxed whitespace-pre-wrap min-w-0 flex-1">
      {{ question }}
    </div>
  </div>

  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
        @click="closeModal"
      >
        <img
          :src="servedUrl"
          alt="Analysis image"
          class="max-h-screen max-w-screen object-contain p-4 select-none"
          @click.stop
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
