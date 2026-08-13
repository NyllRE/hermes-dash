import { useIntervalFn } from "@vueuse/core";

export function useHermesSessionPolling(sessionId: string) {
  const {
    data: messages,
    pending,
    error,
    refresh: refreshMessages,
  } = useHermesSessionMessages(sessionId);
  const {
    data: session,
    error: sessionError,
    refresh: refreshSession,
  } = useHermesSession(sessionId);

  const prevMessageCount = ref(0);
  let isMounted = true;
  const abortController = new AbortController();

  const { pause: pausePoll, resume: resumePoll } = useIntervalFn(
    async () => {
      // Session hasn't loaded yet (initial fetch failed or still in flight):
      // keep retrying instead of idling — otherwise polling deadlocks forever
      // when the initial session fetch fails.
      if (!session.value?.id) {
        await refreshSession(abortController.signal);
        return;
      }
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

  // Start polling as soon as the component mounts, even when the initial
  // session fetch failed. Without this the only start path was the
  // `session.value?.id` watcher below, which never fires while session stays
  // null — a permanent polling deadlock (B1).
  onMounted(() => {
    resumePoll();
  });

  watch(
    () => session.value?.id,
    (id) => {
      if (id) {
        // -1 guarantees the first poll tick pulls messages (count never
        // matches), so a session that only became available via retry still
        // gets its messages loaded.
        prevMessageCount.value = -1;
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
    sessionError,
    isLive,
    refreshMessages,
    refreshSession,
    pausePoll,
    resumePoll,
  };
}
