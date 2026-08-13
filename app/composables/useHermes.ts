import type {
  HermesStatus,
  HermesSession,
  HermesSessionDetail,
  HermesModelInfo,
  HermesMessage,
  SessionStatus,
} from "~/types/hermes";
import { navigateTo } from "#app";
import { markUnauthorized } from "~/middleware/auth.global";

const API_PREFIX = "/api/hermes";

async function hermesFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    // Unauthenticated (missing/expired token): bounce to the login page.
    // hermesFetch never runs on /login itself, but guard the pathname anyway
    // so a stray 401 there can't cause a redirect loop.
    if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
      // Reset the global auth gate's cached verdict so the next navigation
      // re-redirects to /login instead of trusting the stale positive cache.
      markUnauthorized();
      await navigateTo("/login");
    }
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {
      /* keep status text */
    }
    throw new Error(`Hermes API ${res.status}: ${detail}`);
  }
  return res.json();
}

/** Derive session status from API fields. */
export function getSessionStatus(s: {
  is_active: boolean;
  ended_at?: number | null;
  end_reason?: string | null;
  last_active?: number;
}): SessionStatus {
  const now = Date.now() / 1000;
  const lastActive = s.last_active || 0;

  if (s.ended_at) {
    return { label: "ended", color: "neutral" };
  }
  if (s.is_active) {
    return { label: "running", color: "success", icon: "svg-spinners:blocks-wave" };
  }
  if (lastActive > 0 && now - lastActive < 1800) {
    return { label: "waiting", color: "info", icon: "svg-spinners:bars-scale-fade" };
  }
  return { label: "stalled", color: "neutral", icon: "solar:sleeping-square-bold" };
}

/**
 * Reactive status snapshot — gateway health, active sessions, platforms.
 */
export function useHermesStatus() {
  const data = ref<HermesStatus | null>(null);
  const error = ref<string | null>(null);
  const pending = ref(true);

  async function refresh(signal?: AbortSignal) {
    pending.value = true;
    error.value = null;
    try {
      data.value = await hermesFetch<HermesStatus>("/status", signal);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      pending.value = false;
    }
  }

  if (import.meta.client) refresh();

  return { data, error, pending, refresh };
}

/**
 * Reactive session list — recent Hermes conversations.
 */
export function useHermesSessions(limit = 10) {
  const data = ref<{ sessions: HermesSession[]; total: number } | null>(null);
  const error = ref<string | null>(null);
  const pending = ref(true);

  async function refresh(signal?: AbortSignal) {
    pending.value = true;
    error.value = null;
    try {
      data.value = await hermesFetch<{ sessions: HermesSession[]; total: number }>(
        `/sessions?limit=${limit}&order=recent`,
        signal,
      );
    } catch (e: unknown) {
      if (signal?.aborted) return;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      pending.value = false;
    }
  }

  if (import.meta.client) refresh();

  return { data, error, pending, refresh };
}

/**
 * Reactive model info — current provider and model name.
 */
export function useHermesModel() {
  const data = ref<HermesModelInfo | null>(null);
  const error = ref<string | null>(null);
  const pending = ref(true);

  async function refresh(signal?: AbortSignal) {
    pending.value = true;
    error.value = null;
    try {
      data.value = await hermesFetch<HermesModelInfo>("/model/info", signal);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      pending.value = false;
    }
  }

  if (import.meta.client) refresh();

  return { data, error, pending, refresh };
}

/**
 * Fetch full session detail including messages.
 */
export function useHermesSessionMessages(sessionId: string) {
  const data = ref<{ session_id: string; messages: HermesMessage[] } | null>(null);
  const error = ref<string | null>(null);
  const pending = ref(true);

  async function refresh(signal?: AbortSignal) {
    // pending gates only the initial load. Once data exists, background
    // refreshes (polling) update data in place without flipping the
    // loading state — otherwise every poll tick unmounts the chat UI
    // to the loading screen (black flash) and resets scroll/state.
    if (data.value === null) pending.value = true;
    error.value = null;
    try {
      data.value = await hermesFetch<{ session_id: string; messages: HermesMessage[] }>(
        `/sessions/${encodeURIComponent(sessionId)}/messages`,
        signal,
      );
    } catch (e: unknown) {
      if (signal?.aborted) return;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      pending.value = false;
    }
  }

  if (import.meta.client) refresh();

  return { data, error, pending, refresh };
}

/** Fetch a single session's metadata. */
export function useHermesSession(sessionId: string) {
  const data = ref<HermesSessionDetail | null>(null);
  const error = ref<string | null>(null);
  const pending = ref(true);

  async function refresh(signal?: AbortSignal) {
    // Same as useHermesSessionMessages: pending only gates the initial
    // load; background refreshes update in place without a loading flash.
    if (data.value === null) pending.value = true;
    error.value = null;
    try {
      data.value = await hermesFetch<HermesSessionDetail>(
        `/sessions/${encodeURIComponent(sessionId)}`,
        signal,
      );
    } catch (e: unknown) {
      if (signal?.aborted) return;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      pending.value = false;
    }
  }

  if (import.meta.client) refresh();

  return { data, error, pending, refresh };
}

/**
 * One-shot fetch for one-off queries (non-reactive).
 */
export async function hermesQuery<T>(path: string): Promise<T> {
  return hermesFetch<T>(path);
}
