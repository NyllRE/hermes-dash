// useHermes — composable for fetching data from the Hermes dashboard backend.
// Requests go through the Nitro proxy at /api/hermes/* which forwards to the
// Hermes dashboard backend (hermes dashboard).

export interface HermesStatus {
  version: string;
  gateway_state: string | null;
  gateway_platforms: Record<string, { connected: boolean; display_name?: string }>;
  active_sessions: number;
  active_agents: number;
  auth_required: boolean;
}

export interface HermesSession {
  id: string;
  source: string;
  model?: string;
  title: string;
  started_at: number;
  ended_at?: number | null;
  end_reason?: string | null;
  last_active: number;
  message_count: number;
  preview?: string;
  is_active: boolean;
  archived?: boolean;
  profile?: string;
}

/** Derive session status from API fields.
 *  Statuses:
 *    - running:   agent actively processing (within 5min of last activity)
 *    - waiting:   waiting for user input (inactive 5-30min)
 *    - stalled:   idle for 30min+, session hung or abandoned
 *    - ended:     session finished (ended_at set)
 */
export function getSessionStatus(s: {
  is_active: boolean;
  ended_at?: number | null;
  end_reason?: string | null;
  last_active?: number;
}): {
  label: string;
  color: "success" | "warning" | "neutral" | "info";
  icon?: string;
} {
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

export interface HermesModelInfo {
  model: string;
  provider: string;
  auto_context_length: number;
  effective_context_length: number;
}

// All requests go through the same-origin Nitro proxy.
const API_PREFIX = "/api/hermes";

async function hermesFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
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
    } catch (e: any) {
      if (signal?.aborted) return;
      error.value = e.message;
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
    } catch (e: any) {
      if (signal?.aborted) return;
      error.value = e.message;
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
    } catch (e: any) {
      if (signal?.aborted) return;
      error.value = e.message;
    } finally {
      pending.value = false;
    }
  }

  if (import.meta.client) refresh();

  return { data, error, pending, refresh };
}

export interface HermesMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: any[] | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
  timestamp: number;
  token_count?: number | null;
  finish_reason?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
}

export interface HermesSessionDetail extends HermesSession {
  messages?: HermesMessage[];
}

/**
 * Fetch full session detail including messages.
 */
export function useHermesSessionMessages(sessionId: string) {
  const data = ref<{ session_id: string; messages: HermesMessage[] } | null>(null);
  const error = ref<string | null>(null);
  const pending = ref(true);

  async function refresh(signal?: AbortSignal) {
    pending.value = true;
    error.value = null;
    try {
      data.value = await hermesFetch<{ session_id: string; messages: HermesMessage[] }>(
        `/sessions/${encodeURIComponent(sessionId)}/messages`,
        signal,
      );
    } catch (e: any) {
      if (signal?.aborted) return;
      error.value = e.message;
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
    pending.value = true;
    error.value = null;
    try {
      data.value = await hermesFetch<HermesSessionDetail>(
        `/sessions/${encodeURIComponent(sessionId)}`,
        signal,
      );
    } catch (e: any) {
      if (signal?.aborted) return;
      error.value = e.message;
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
