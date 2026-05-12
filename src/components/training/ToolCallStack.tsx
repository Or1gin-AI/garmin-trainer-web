'use client';

import { ToolCallCard, type ToolEventUi } from './ToolCallCard';

export function ToolCallStack({ events }: { events: ToolEventUi[] }) {
  if (events.length === 0) return null;
  const ordered = [...events].sort((a, b) => a.orderKey - b.orderKey);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {ordered.map((ev) => (
        <ToolCallCard key={ev.id} ev={ev} />
      ))}
    </div>
  );
}

/**
 * Reducer-style helper: apply an incoming SSE `tool_event` payload to an
 * existing Map<id, ToolEventUi>. Returns a NEW Map (immutable). start adds a
 * row, done/error replace the same-id row.
 */
export function applyToolEvent(
  current: Map<string, ToolEventUi>,
  payload: {
    id: string;
    name: string;
    displayName: string;
    phase: 'start' | 'done' | 'error';
    summary?: string;
    errorMessage?: string;
    durationMs?: number;
  },
  orderCounterRef: { current: number },
): Map<string, ToolEventUi> {
  const next = new Map(current);
  const existing = next.get(payload.id);
  const orderKey = existing ? existing.orderKey : (orderCounterRef.current += 1);
  next.set(payload.id, {
    id: payload.id,
    name: payload.name,
    displayName: payload.displayName,
    phase: payload.phase,
    summary: payload.summary,
    errorMessage: payload.errorMessage,
    durationMs: payload.durationMs,
    orderKey,
  });
  return next;
}
