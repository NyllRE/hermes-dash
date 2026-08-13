// Live chat over the Hermes gateway WebSocket (JSON-RPC), proxied through
// the Nuxt app at /ws. The Hermes session token is injected by the proxy
// server-side — the browser only carries the dashboard cookie.
//
// Wire protocol (gateway tui_gateway/ws.py + server.py):
//   outbound methods: session.create, session.resume, prompt.submit,
//     session.interrupt, session.steer
//   inbound events:    gateway.ready, session.info (running flag),
//     message.start/delta/complete, reasoning.delta, thinking.delta,
//     tool.start/generating/complete, status.update, session.title, error
import type { LocalMessage } from "~/types/hermes"

export interface LiveToolState {
  tool_id: string
  name: string
  status: 'running' | 'generating' | 'done' | 'error'
  args_text?: string
  result_text?: string
  duration_s?: number
}

export interface SessionInfoPayload {
  running?: boolean
  model?: string
  provider?: string
  title?: string
  [key: string]: unknown
}

export interface ModelOverride {
  model?: string
  provider?: string
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

interface GatewayEventParams {
  type: string
  session_id?: string
  payload?: Record<string, unknown>
}

const WS_RECONNECT_BASE_MS = 1000
const WS_RECONNECT_MAX_MS = 15000

export function useHermesChatSocket(options: { sessionId?: string | null } = {}) {
  // Reactive state
  const connected = ref(false)
  const ready = ref(false) // gateway.ready received
  const running = ref(false) // from session.info (authoritative)
  const streaming = ref(false) // message.start → message.complete window
  const sessionId = ref<string | null>(options.sessionId ?? null)
  const sessionInfo = ref<SessionInfoPayload | null>(null)
  const liveText = ref('')
  const liveReasoning = ref('')
  const liveTools = ref<LiveToolState[]>([])
  const statusLine = ref<string | null>(null)
  const lastError = ref<string | null>(null)
  // In-flight exchange assembled from WS events (user prompt + assistant
  // reply). The page merges this after the polled history.
  const localMessages = ref<LocalMessage[]>([])

  const modelOverride = ref<ModelOverride>({})

  // Internals
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  let closedByUser = false
  let ridCounter = 0
  const outbox: JsonRpcRequest[] = []
  const pendingRequests = new Map<
    string,
    { resolve: (result: unknown) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()

  function nextRid(): string {
    ridCounter += 1
    return `hd-${Date.now()}-${ridCounter}`
  }

  function sendRequest(method: string, params: Record<string, unknown>): string {
    const request: JsonRpcRequest = { jsonrpc: '2.0', id: nextRid(), method, params }
    const raw = JSON.stringify(request)
    if (ready.value && ws?.readyState === WebSocket.OPEN && raw !== undefined) {
      ws.send(raw)
    } else {
      // Buffered until the socket is up AND gateway.ready has arrived.
      outbox.push(request)
    }
    return request.id
  }

  /** Send a request and resolve with its result (rejects on gateway error or timeout). */
  function request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    const id = sendRequest(method, params)
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id)
        reject(new Error(`Gateway request timed out: ${method}`))
      }, 15000)
      pendingRequests.set(id, { resolve: (r) => resolve(r as T), reject, timer })
    })
  }

  function flushOutbox() {
    if (!ready.value || ws?.readyState !== WebSocket.OPEN) return
    while (outbox.length > 0) {
      const next = outbox.shift()
      if (!next) break
      const raw = JSON.stringify(next)
      if (raw !== undefined) ws.send(raw)
    }
  }

  // ── Public actions ───────────────────────────────────────────────────

  /** Send a prompt (idle state). The gateway queues it if a turn is busy. */
  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !sessionId.value) return
    localMessages.value.push({ role: 'user', content: trimmed })
    sendRequest('prompt.submit', {
      session_id: sessionId.value,
      text: trimmed,
      ...(modelOverride.value.model ? { model: modelOverride.value.model } : {}),
      ...(modelOverride.value.provider ? { provider: modelOverride.value.provider } : {}),
    })
  }

  /** Inject a message into the live turn without interrupting (running state). */
  function steer(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !sessionId.value) return
    sendRequest('session.steer', { session_id: sessionId.value, text: trimmed })
  }

  /** Enqueue a prompt to run as the next turn without interrupting. */
  function queue(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !sessionId.value) return
    sendRequest('prompt.submit', {
      session_id: sessionId.value,
      text: trimmed,
      queued: true,
    })
  }

  /** Interrupt the running turn. */
  function interrupt() {
    if (!sessionId.value) return
    sendRequest('session.interrupt', { session_id: sessionId.value })
  }

  /**
   * Start a brand-new session. `model`/`provider` become the per-session
   * override (the gateway only accepts them at session.create — prompt.submit
   * has no model field).
   */
  function createSession(model?: string, provider?: string) {
    return sendRequest('session.create', {
      source: 'hermes-dash',
      ...(model ? { model } : {}),
      ...(provider ? { provider } : {}),
    })
  }

  /**
   * Start a brand-new session and resolve with the gateway's full response:
   * short `session_id` (used for prompt.submit) plus `stored_session_id`
   * (the id the REST API / session viewer URLs use).
   */
  function createSessionAsync(
    model?: string,
    provider?: string,
  ): Promise<{ session_id: string; stored_session_id: string; [key: string]: unknown }> {
    return request('session.create', {
      source: 'hermes-dash',
      ...(model ? { model } : {}),
      ...(provider ? { provider } : {}),
    })
  }

  /** Re-attach to an existing session (re-binds the gateway transport). */
  function resumeSession(id: string) {
    sessionId.value = id
    sendRequest('session.resume', { session_id: id })
  }

  /** Remember the model the user picked; carried on submit/create. */
  function setModel(model: string, provider: string) {
    modelOverride.value = { model, provider }
  }

  // ── Socket lifecycle ─────────────────────────────────────────────────

  function scheduleReconnect() {
    if (closedByUser || reconnectTimer) return
    const delay = Math.min(
      WS_RECONNECT_BASE_MS * 2 ** reconnectAttempts,
      WS_RECONNECT_MAX_MS,
    )
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect() {
    if (
      ws?.readyState === WebSocket.OPEN ||
      ws?.readyState === WebSocket.CONNECTING
    ) {
      return
    }
    closedByUser = false
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${proto}://${window.location.host}/ws`)
    ws = socket

    socket.addEventListener('open', () => {
      connected.value = true
      reconnectAttempts = 0
    })

    socket.addEventListener('message', (event) => {
      handleFrame(String(event.data))
    })

    socket.addEventListener('close', () => {
      connected.value = false
      ready.value = false
      if (ws === socket) ws = null
      if (!closedByUser) scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      // A close event always follows; nothing to do here.
    })
  }

  function disconnect() {
    closedByUser = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      const socket = ws
      ws = null
      socket.close()
    }
    connected.value = false
    ready.value = false
  }

  // ── Frame handling ───────────────────────────────────────────────────

  function handleFrame(raw: string) {
    let frame: unknown
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }
    if (!frame || typeof frame !== 'object') return
    const msg = frame as JsonRpcResponse & {
      method?: string
      params?: GatewayEventParams
    }
    if (msg.method === 'event' && msg.params) {
      handleEvent(msg.params)
      return
    }
    handleResponse(msg)
  }

  function handleEvent(params: GatewayEventParams) {
    const payload = params.payload ?? {}
    switch (params.type) {
      case 'gateway.ready':
        ready.value = true
        // Re-attach on every (re)connect — the gateway replays session.info
        // after resume, which refreshes `running`.
        if (sessionId.value) {
          sendRequest('session.resume', { session_id: sessionId.value })
        }
        flushOutbox()
        break

      case 'session.info':
        sessionInfo.value = payload as SessionInfoPayload
        running.value = payload.running === true
        if (params.session_id) sessionId.value = params.session_id
        break

      case 'message.start':
        streaming.value = true
        liveText.value = ''
        liveReasoning.value = ''
        liveTools.value = []
        localMessages.value.push({ role: 'assistant', content: '' })
        break

      case 'message.delta': {
        const text = payload.text
        if (typeof text === 'string' && text) {
          liveText.value += text
          const last = localMessages.value[localMessages.value.length - 1]
          if (last?.role === 'assistant') last.content += text
        }
        break
      }

      case 'reasoning.delta':
      case 'thinking.delta': {
        const text = payload.text
        if (typeof text === 'string' && text) liveReasoning.value += text
        break
      }

      case 'message.complete': {
        streaming.value = false
        const text = typeof payload.text === 'string' ? payload.text : ''
        const last = localMessages.value[localMessages.value.length - 1]
        if (last?.role === 'assistant') {
          if (text && last.content !== text) last.content = text
        } else if (text) {
          // Mid-turn resume: no message.start was seen on this socket.
          localMessages.value.push({ role: 'assistant', content: text })
        }
        break
      }

      case 'tool.start':
        liveTools.value.push({
          tool_id: String(payload.tool_id ?? ''),
          name: typeof payload.name === 'string' ? payload.name : '',
          args_text: typeof payload.args_text === 'string' ? payload.args_text : undefined,
          status: 'running',
        })
        break

      case 'tool.generating': {
        const name = typeof payload.name === 'string' ? payload.name : ''
        const last = liveTools.value[liveTools.value.length - 1]
        if (last && (!name || last.name === name)) last.status = 'generating'
        break
      }

      case 'tool.complete': {
        const id = String(payload.tool_id ?? '')
        const tool = liveTools.value.find((t) => t.tool_id === id)
        if (tool) {
          tool.status = payload.error ? 'error' : 'done'
          if (typeof payload.result_text === 'string') tool.result_text = payload.result_text
          if (typeof payload.duration_s === 'number') tool.duration_s = payload.duration_s
        }
        break
      }

      case 'status.update':
        statusLine.value =
          typeof payload.text === 'string' && payload.text ? payload.text : null
        break

      case 'session.title':
        if (sessionInfo.value) {
          sessionInfo.value.title =
            typeof payload.title === 'string' ? payload.title : sessionInfo.value.title
        }
        break

      case 'error':
        lastError.value =
          typeof payload.message === 'string' ? payload.message : 'Gateway error'
        streaming.value = false
        break
    }
  }

  function handleResponse(msg: JsonRpcResponse) {
    const pending = pendingRequests.get(msg.id)
    if (pending) {
      pendingRequests.delete(msg.id)
      clearTimeout(pending.timer)
      if (msg.error) pending.reject(new Error(msg.error.message || 'Gateway request failed'))
      else pending.resolve(msg.result)
      // Fall through so session.create / session.resume still record the id.
    }
    if (msg.error) {
      lastError.value = msg.error.message || 'Gateway request failed'
      return
    }
    // session.create / session.resume carry the live session id.
    if (msg.result && typeof msg.result === 'object') {
      const result = msg.result as { session_id?: unknown }
      if (typeof result.session_id === 'string') {
        sessionId.value = result.session_id
      }
    }
  }

  if (import.meta.client) {
    onMounted(connect)
    onUnmounted(disconnect)
  }

  return {
    connected,
    ready,
    running,
    streaming,
    sessionId,
    sessionInfo,
    liveText,
    liveReasoning,
    liveTools,
    statusLine,
    lastError,
    localMessages,
    connect,
    disconnect,
    createSession,
    createSessionAsync,
    resumeSession,
    submit,
    steer,
    queue,
    interrupt,
    setModel,
  }
}
