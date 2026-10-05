'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  trainingChatStreamUrl,
  type TrainingChatMessage,
  type TrainingWorkout,
} from '@/lib/api';
import { streamSse, type SseEvent } from '@/lib/sse';
import { T, Btn, Card, TrackTextarea } from '@/components/track';
import { ToolCallStack, applyToolEvent } from '@/components/training/ToolCallStack';
import type { ToolEventUi } from '@/components/training/ToolCallCard';

const TOOL_LABELS: Record<string, string> = {
  regenerate_day: 'RegenerateTraining',
  update_workout_field: 'UpdatingTrainingStatus',
};

const STATUS_ZH: Record<string, string> = {
  completed: 'Completed',
  skipped: 'Skipped',
  planned: 'Planned',
};

interface PersistedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface DraftAssistant {
  id: string;
  content: string;
  toolEvents: Map<string, ToolEventUi>;
  createdAt: string;
}

type ListItem =
  | { kind: 'persisted'; message: TrainingChatMessage }
  | { kind: 'draft'; draft: DraftAssistant };

export interface ChatPanelProps {
  planId: string;
  initialMessages: TrainingChatMessage[];
  onWorkoutUpdated: (workout: TrainingWorkout) => void;
}

export function ChatPanel({
  planId,
  initialMessages,
  onWorkoutUpdated,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<TrainingChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState<DraftAssistant | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const orderCounterRef = useRef({ current: 0 });

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const items: ListItem[] = useMemo(() => {
    const out: ListItem[] = messages.map((m) => ({ kind: 'persisted' as const, message: m }));
    if (draft) out.push({ kind: 'draft' as const, draft });
    return out;
  }, [messages, draft]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const text = composerValue.trim();
    if (!text || streaming) return;
    setError(null);
    setStreaming(true);

    const optimisticId = `local-user-${Date.now()}`;
    const optimisticUser: TrainingChatMessage = {
      id: optimisticId,
      planId,
      userId: '',
      role: 'user',
      content: text,
      toolCalls: null,
      toolResultRefs: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setComposerValue('');

    let draftId = '';
    const ensureDraft = () => {
      if (!draftId) {
        draftId = `draft-${Date.now()}`;
        setDraft({
          id: draftId,
          content: '',
          toolEvents: new Map(),
          createdAt: new Date().toISOString(),
        });
      }
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamSse({
        url: trainingChatStreamUrl(planId),
        body: { message: text },
        signal: ctrl.signal,
        onEvent: (ev: SseEvent) => {
          const data = (ev.data ?? null) as Record<string, unknown> | null;
          if (!data) return;

          if (ev.event === 'user_message_saved') {
            const persisted = data.message as TrainingChatMessage | undefined;
            if (!persisted) return;
            setMessages((prev) => prev.map((m) => (m.id === optimisticId ? persisted : m)));
            return;
          }
          if (ev.event === 'text_delta') {
            const piece = typeof data.text === 'string' ? data.text : '';
            if (!piece) return;
            ensureDraft();
            setDraft((prev) => (prev ? { ...prev, content: prev.content + piece } : prev));
            return;
          }
          if (ev.event === 'tool_event') {
            ensureDraft();
            const payload = data as {
              id: string;
              name: string;
              displayName: string;
              phase: 'start' | 'done' | 'error';
              summary?: string;
              errorMessage?: string;
              durationMs?: number;
            };
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    toolEvents: applyToolEvent(prev.toolEvents, payload, orderCounterRef.current),
                  }
                : prev,
            );
            return;
          }
          if (ev.event === 'workout_updated') {
            const w = data.workout as TrainingWorkout | undefined;
            if (!w) return;
            onWorkoutUpdated(w);
            return;
          }
          if (ev.event === 'assistant_message_saved') {
            const persisted = data.message as TrainingChatMessage | undefined;
            if (!persisted) return;
            setMessages((prev) => [...prev, persisted]);
            setDraft(null);
            draftId = '';
            return;
          }
          if (ev.event === 'error') {
            const msg =
              typeof data.message === 'string'
                ? mapErrorCode(data.message)
                : typeof data.error === 'string'
                  ? mapErrorCode(data.error)
                  : 'Chat failed. Please try again later.';
            ensureDraft();
            setDraft((prev) => (prev ? { ...prev, content: msg } : prev));
            setError(null);
            return;
          }
        },
      });
    } catch (e) {
      const errObj = e as Error & { status?: number; detail?: { error?: string; message?: string } };
      let msg: string;
      if (errObj.status === 402) {
        msg = mapErrorCode(errObj.detail?.message ?? errObj.detail?.error ?? errObj.message);
      } else {
        msg = errObj.message || 'Chat failed. Please try again later.';
      }
      ensureDraft();
      setDraft((prev) => (prev ? { ...prev, content: msg } : prev));
      setError(null);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [composerValue, planId, streaming, onWorkoutUpdated]);

  return (
    <Card style={{
      padding: 0, display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 48px)', maxHeight: 'calc(100vh - 48px)',
    }}>
      <div style={{
        padding: '16px 18px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5 }}>AI Coach</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: T.ink }}>Coach chat</div>
        </div>
        {streaming ? (
          <span className="track-blink" style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.2 }}>
            ● Thinking…
          </span>
        ) : (
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.green, letterSpacing: 1.2 }}>● Ready</span>
        )}
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 320 }}
      >
        {items.length === 0 && (
          <p style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.6, margin: 0 }}>
            canThis week’s planquestion，For example：「Why WednesdayisThreshold run」「， LSD 」。
          </p>
        )}
        {items.map((item) => (
          item.kind === 'persisted'
            ? <PersistedTurn key={item.message.id} message={item.message} />
            : <DraftTurn key={item.draft.id} draft={item.draft} />
        ))}
        {streaming && !draft && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.mono, fontSize: 11, color: T.inkFaint, paddingLeft: 4 }}>
            <span className="track-blink" style={{ width: 6, height: 6, background: T.lime, borderRadius: 999, display: 'inline-block' }} />
            <span>Coach is replying…</span>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          margin: '0 12px 8px', padding: '8px 10px', borderRadius: 6,
          background: T.redSoft, border: `1px solid ${T.red}40`,
          fontSize: 12, color: T.red,
        }}>
          {error}
        </div>
      )}

      <div style={{ padding: 12, borderTop: `1px solid ${T.border}` }}>
        <TrackTextarea
          value={composerValue}
          rows={2}
          disabled={streaming}
          onChange={(e) => setComposerValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={streaming ? 'Waiting for a reply…' : 'Your AI coach（Enter Send，Shift+Enter new line）'}
          style={{ resize: 'none', fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1 }}>
            ⏎ Send · ⇧⏎ new line
          </span>
          <Btn size="sm" onClick={() => void handleSend()} disabled={streaming || composerValue.trim().length === 0}>
            Send ↵
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function PersistedTurn({ message }: { message: TrainingChatMessage }) {
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '88%', padding: '10px 12px', borderRadius: 10,
          background: T.lime, color: T.bg, fontSize: 13, lineHeight: 1.5,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {message.content}
          <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(11,14,12,0.55)', textAlign: 'right', marginTop: 4 }}>
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }
  if (message.role === 'assistant') {
    const tcs = (message.toolCalls ?? []) as PersistedToolCall[] | null;
    const toolEvents: ToolEventUi[] = (tcs ?? []).map((tc, i) => ({
      id: `${message.id}-${i}`,
      name: tc.name,
      displayName: TOOL_LABELS[tc.name] ?? tc.name,
      phase: 'done',
      summary: summarizePersistedToolCall(tc),
      orderKey: i,
    }));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        {message.content && (
          <div style={{
            maxWidth: '92%', padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
            fontSize: 13, color: T.ink, lineHeight: 1.6,
          }}>
            <div className="track-md">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, marginTop: 6 }}>
              {formatTime(message.createdAt)} · coach
            </div>
          </div>
        )}
        {toolEvents.length > 0 && (
          <div style={{ maxWidth: '92%', alignSelf: 'flex-start', width: '100%' }}>
            <ToolCallStack events={toolEvents} />
          </div>
        )}
      </div>
    );
  }
  return null;
}

function DraftTurn({ draft }: { draft: DraftAssistant }) {
  const events = Array.from(draft.toolEvents.values());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div style={{
        maxWidth: '92%', padding: '10px 12px', borderRadius: 10,
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cyan}40`,
        fontSize: 13, color: T.ink, lineHeight: 1.6,
      }}>
        {draft.content.length > 0 ? (
          <div className="track-md">
            <ReactMarkdown>{draft.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="track-blink" style={{ fontFamily: T.mono, fontSize: 11, color: T.cyan, letterSpacing: 1 }}>
            ● Coach is thinking…
          </div>
        )}
      </div>
      {events.length > 0 && (
        <div style={{ maxWidth: '92%', alignSelf: 'flex-start', width: '100%' }}>
          <ToolCallStack events={events} />
        </div>
      )}
    </div>
  );
}

function summarizePersistedToolCall(tc: PersistedToolCall): string | undefined {
  if (tc.name === 'regenerate_day') {
    const di = tc.arguments?.dayIndex;
    if (typeof di === 'number') return `Day  ${di} daysRegenerate`;
    return 'RegenerateTraining';
  }
  if (tc.name === 'update_workout_field') {
    const v = tc.arguments?.value;
    if (typeof v === 'string') return `Status：${STATUS_ZH[v] ?? v}`;
    return 'UpdatingTrainingStatus';
  }
  return undefined;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function mapErrorCode(code: string): string {
  switch (code) {
    case 'pro_required': return 'AI CoachCoach chat is a Max membership feature. This account is Free, Plus, or has an expired Max plan. Upgrade or redeem Max to unlock it.';
    case 'max_required': return 'AI CoachCoach chat is a Max membership feature. This account is Free, Plus, or has an expired Max plan. Upgrade or redeem Max to unlock it.';
    case 'quota_exceeded': return 'month AI chat。';
    case 'llm_not_configured': return 'AI Modelnot yetConfiguration，Please Manage 。';
    case 'persist_user_message_failed': return 'SaveusersmessageFailed，Please Retry。';
    case 'persist_assistant_message_failed': return 'SavereplyFailed，Please Retry。';
    case 'plan_request_corrupt': return 'planRecords，NoneContinuechat。';
    case 'not_found': return 'Plan not foundorcurrent Account。';
    case 'chat_failed':
    default: return code || 'Chat failed. Please try again later.。';
  }
}
