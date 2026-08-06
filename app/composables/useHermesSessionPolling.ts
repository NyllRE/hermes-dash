import { useIntervalFn } from "@vueuse/core";

export function useHermesSessionPolling(sessionId: string) {
  const {
    data: messages,
    pending,
    error,
    refresh: refreshMessages,
  } = useHermesSessionMessages(sessionId);
  const { data: session, refresh: refreshSession } = useHermesSession(sessionId);

  const prevMessageCount = ref(0);
  let isMounted = true;
  const abortController = new AbortController();

  const { pause: pausePoll, resume: resumePoll } = useIntervalFn(
    async () => {
      if (!session.value?.id) return;
      if (session.value?.ended_at) {
        pausePoll();
        return;
      }
      await refreshSession(abortController.signal);
      if (!isMounted) return;
      if (session.value?.ended_at) {
        pausePoll();
        return;
      }
      const newCount = session.value?.message_count ?? 0;
      if (newCount !== prevMessageCount.value) {
        prevMessageCount.value = newCount;
        await refreshMessages(abortController.signal);
      }
    },
    2000,
    { immediate: false },
  );

  watch(
    () => session.value?.id,
    (id) => {
      if (id) {
        prevMessageCount.value = session.value?.message_count ?? 0;
        if (!session.value?.ended_at) resumePoll();
      }
    },
  );

  watch(
    () => session.value?.ended_at,
    (ended) => {
      if (ended) pausePoll();
    },
  );

  const isLive = computed(() => !!(session.value?.is_active && !session.value?.ended_at));

  onUnmounted(() => {
    isMounted = false;
    pausePoll();
    abortController.abort();
  });

  return {
    messages,
    session,
    pending,
    error,
    isLive,
    refreshMessages,
    refreshSession,
    pausePoll,
    resumePoll,
  };
}
