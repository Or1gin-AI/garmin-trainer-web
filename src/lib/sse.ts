// SSE consumer over fetch + ReadableStream.
//
// We deliberately don't use the native EventSource because:
//   - EventSource is GET-only; our backend's training endpoints expect POST
//     with a JSON body
//   - EventSource doesn't forward the cookie credentials we need cross-site
//     unless `withCredentials: true` is set, and even then it doesn't carry
//     custom headers
//
// This implementation POSTs JSON, opts into credentials, and parses the
// `event:`/`data:` text-protocol incrementally, dispatching each block to
// the consumer. It does not auto-reconnect — the training streams are short
// one-shot generations, not long-lived feeds.

export interface SseEvent {
  event: string;
  data: unknown;
}

export interface SseStreamArgs {
  url: string; // absolute, including API_BASE
  body: unknown; // POSTed as JSON
  signal?: AbortSignal;
  onEvent: (ev: SseEvent) => void;
  // Called when the stream ends without an error event. Optional.
  onClose?: () => void;
}

/**
 * Open a POST request that returns text/event-stream, parse event/data lines,
 * and dispatch each block via onEvent. Resolves when the stream ends — either
 * because the server closed it or because the AbortSignal fired.
 *
 * Throws if the initial response is not ok (HTTP error before stream starts).
 */
export async function streamSse(args: SseStreamArgs): Promise<void> {
  const res = await fetch(args.url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(args.body ?? {}),
    signal: args.signal,
  });

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      // ignore — body wasn't JSON
    }
    const message =
      (detail && typeof detail === 'object' && 'message' in detail
        ? String((detail as { message: unknown }).message)
        : null) ??
      (detail && typeof detail === 'object' && 'error' in detail
        ? String((detail as { error: unknown }).error)
        : null) ?? `HTTP ${res.status}`;
    const err = new Error(message) as Error & { status?: number; detail?: unknown };
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  if (!res.body) {
    args.onClose?.();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const onAbort = () => {
    // Cancelling a reader rejects pending reads, which we swallow below.
    reader.cancel().catch(() => {});
  };
  args.signal?.addEventListener('abort', onAbort);

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // Aborted or network blip — treat as stream end.
        break;
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      // SSE blocks are terminated by a blank line. Use \n\n; tolerate \r\n\r\n
      // by normalizing CRLF first.
      buffer = buffer.replace(/\r\n/g, '\n');
      let sepIdx: number;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const parsed = parseBlock(block);
        if (parsed) args.onEvent(parsed);
      }
    }

    // Flush any remaining buffered block (servers SHOULD terminate with \n\n
    // but we accept a trailing partial just in case).
    const trailing = buffer.trim();
    if (trailing.length > 0) {
      const parsed = parseBlock(trailing);
      if (parsed) args.onEvent(parsed);
    }
  } finally {
    args.signal?.removeEventListener('abort', onAbort);
  }

  args.onClose?.();
}

function parseBlock(block: string): SseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/^﻿/, '');
    if (line.length === 0) continue;
    // Comment line — `:` prefix per SSE spec (heartbeats use `: ping`).
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // Per spec, a single leading space after the colon is stripped.
      const v = line.slice(5);
      dataLines.push(v.startsWith(' ') ? v.slice(1) : v);
    }
    // id: / retry: lines are ignored — we don't reconnect.
  }

  if (dataLines.length === 0 && event === 'message') return null;
  const raw = dataLines.join('\n');
  let data: unknown = raw;
  if (raw.length > 0) {
    try {
      data = JSON.parse(raw);
    } catch {
      // keep raw string
    }
  }
  return { event, data };
}
