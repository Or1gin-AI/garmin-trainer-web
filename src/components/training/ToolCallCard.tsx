'use client';

import { T } from '@/components/track';

export interface ToolEventUi {
  id: string;
  name: string;
  displayName: string;
  phase: 'start' | 'done' | 'error';
  summary?: string;
  errorMessage?: string;
  durationMs?: number;
  orderKey: number;
}

const ICONS: Record<ToolEventUi['phase'], string> = {
  start: '🔧',
  done: '✅',
  error: '⚠️',
};

const COLORS: Record<ToolEventUi['phase'], { border: string; text: string }> = {
  start: { border: `${T.cyan}55`, text: T.cyan },
  done: { border: `${T.green}45`, text: T.green },
  error: { border: `${T.amber}66`, text: T.amber },
};

export function ToolCallCard({ ev }: { ev: ToolEventUi }) {
  const palette = COLORS[ev.phase];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${palette.border}`,
        background: 'rgba(255,255,255,0.025)',
        fontSize: 12,
        lineHeight: 1.45,
        maxWidth: '100%',
      }}
    >
      <span
        aria-hidden
        className={ev.phase === 'start' ? 'track-blink' : ''}
        style={{
          flexShrink: 0,
          fontSize: 13,
          lineHeight: 1.2,
          marginTop: 1,
        }}
      >
        {ICONS[ev.phase]}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11.5,
            color: palette.text,
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        >
          {ev.displayName}
          {ev.phase === 'start' && (
            <span style={{ color: T.inkFaint, marginLeft: 6, fontWeight: 400 }}>
              · 进行中…
            </span>
          )}
          {ev.phase === 'done' && ev.durationMs != null && (
            <span
              style={{ color: T.inkFaint, marginLeft: 8, fontWeight: 400 }}
            >
              · {formatDuration(ev.durationMs)}
            </span>
          )}
        </div>
        {ev.phase === 'done' && ev.summary && (
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: T.inkDim,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {ev.summary}
          </div>
        )}
        {ev.phase === 'error' && (
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: T.amber,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {ev.errorMessage || '失败'}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}
