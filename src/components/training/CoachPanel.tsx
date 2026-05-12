'use client';

import { type ReactNode } from 'react';
import { T, Card } from '@/components/track';
import { ToolCallStack } from './ToolCallStack';
import type { ToolEventUi } from './ToolCallCard';

export interface CoachPanelProps {
  /** Sorted tool event rows to render in the timeline. */
  events: ToolEventUi[];
  /** Streaming summary text (typewriter); empty means none yet. */
  summaryText?: string;
  /** Right-side status badge text + animation flag. */
  status?: { label: string; anim?: boolean; tone?: 'lime' | 'green' | 'amber' | 'cyan' };
  /** Optional title (default: "AI 教练"). */
  title?: string;
  /** Eyebrow (default: "// AI 实时过程"). */
  eyebrow?: string;
  /** Optional footer slot (e.g. cancel button). */
  footer?: ReactNode;
}

export function CoachPanel({
  events,
  summaryText,
  status,
  title = 'AI 教练',
  eyebrow = '// AI 实时过程',
  footer,
}: CoachPanelProps) {
  const toneColor =
    status?.tone === 'green'
      ? T.green
      : status?.tone === 'amber'
        ? T.amber
        : status?.tone === 'cyan'
          ? T.cyan
          : T.lime;
  return (
    <Card style={{ padding: 0 }}>
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: T.lime,
              letterSpacing: 1.5,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginTop: 2,
              color: T.ink,
            }}
          >
            {title}
          </div>
        </div>
        {status && (
          <span
            className={status.anim ? 'track-blink' : ''}
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: toneColor,
              letterSpacing: 1.2,
            }}
          >
            ● {status.label}
          </span>
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {summaryText && summaryText.length > 0 && (
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 13,
              color: T.ink,
              lineHeight: 1.7,
              whiteSpace: 'pre-line',
            }}
          >
            {summaryText}
          </div>
        )}
        {events.length === 0 && !summaryText ? (
          <div
            className="track-blink"
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              color: T.inkFaint,
              letterSpacing: 1.2,
            }}
          >
            ● 正在准备 AI 教练…
          </div>
        ) : (
          <ToolCallStack events={events} />
        )}
      </div>

      {footer && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          {footer}
        </div>
      )}
    </Card>
  );
}
