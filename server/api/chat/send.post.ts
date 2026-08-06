// Proxy chat completions to the Hermes OpenAI-compatible API server (port 8642).
// Supports both streaming (SSE) and non-streaming responses.

import { defineEventHandler, readBody, createError, setHeader, H3Error } from "h3";
import { assertDashboardAccess } from "../../utils/dashboardAuth";

export default defineEventHandler(async (event) => {
  assertDashboardAccess(event);

  const body = await readBody(event);
  const messages = body?.messages || [];
  const stream = body?.stream !== false;

  const target = "http://127.0.0.1:8642/v1/chat/completions";

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "hermes-agent", messages, stream }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw createError({ statusCode: response.status, message: text });
    }

    if (!stream || !response.body) {
      // Non-streaming: return JSON
      const data = await response.json();
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: data.choices?.[0]?.message?.content || "No response",
            },
          },
        ],
      };
    }

    // Streaming: pipe SSE chunks through to the client
    setHeader(event, "Content-Type", "text/event-stream");
    setHeader(event, "Cache-Control", "no-cache");
    setHeader(event, "Connection", "keep-alive");

    const reader = response.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            event.node.res.end();
            break;
          }
          event.node.res.write(value);
        }
      } catch {
        event.node.res.end();
      }
    };
    pump();
  } catch (e: unknown) {
    if (e instanceof H3Error) throw e;
    throw createError({
      statusCode: 503,
      statusMessage: "Hermes API server not reachable on port 8642",
      message: e instanceof Error ? e.message : String(e),
    });
  }
});
