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

const TOOL_LABELS: Record<string, string> = {
  regenerate_day: '重新生成训练',
  update_workout_field: '更新训练状态',
};

const STATUS_ZH: Record<string, string> = {
  completed: '已完成',
  skipped: '已跳过',
  planned: '计划中',
};

interface UiToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface DraftAssistant {
  id: string;
  content: string;
  toolCalls: UiToolCall[];
  createdAt: string;
}

type ListItem =
  | { kind: 'persisted'; message: TrainingChatMessage }
  | { kind: 'draft'; draft: DraftAssistant };

export interface ChatPanelProps {
  planId: string;
  initialMessages: TrainingChatMessage[];
  onWorkoutUpdated: (workout: TrainingWorkout) => void;
  onWorkoutFieldUpdated: (workoutId: string, field: string, value: string) => void;
}

export function ChatPanel({
  planId,
  initialMessages,
  onWorkoutUpdated,
  onWorkoutFieldUpdated,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<TrainingChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState<DraftAssistant | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
        setDraft({ id: draftId, content: '', toolCalls: [], createdAt: new Date().toISOString() });
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
          if (ev.event === 'tool_call') {
            ensureDraft();
            const name = typeof data.name === 'string' ? data.name : 'unknown';
            const args = data.arguments && typeof data.arguments === 'object'
              ? (data.arguments as Record<string, unknown>)
              : {};
            setDraft((prev) => (prev ? { ...prev, toolCalls: [...prev.toolCalls, { name, arguments: args }] } : prev));
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
            const msg = typeof data.error === 'string' ? mapErrorCode(data.error) : '对话失败，请稍后重试';
            setError(msg);
            return;
          }
        },
      });
    } catch (e) {
      const errObj = e as Error & { status?: number };
      if (errObj.status === 402) {
        setError('当前未开通 Pro 或本月对话额度已用完。');
      } else {
        setError(errObj.message || '对话失败，请稍后重试');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [composerValue, planId, streaming, onWorkoutUpdated]);

  void onWorkoutFieldUpdated;

  return (
    <Card style={{
      padding: 0, position: 'sticky', top: 76, alignSelf: 'start',
      maxHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '16px 18px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5 }}>// AI 教练</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: T.ink }}>对话教练</div>
        </div>
        {streaming ? (
          <span className="track-blink" style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.2 }}>
            ● 思考中…
          </span>
        ) : (
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.green, letterSpacing: 1.2 }}>● 待命</span>
        )}
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 360 }}
      >
        {items.length === 0 && (
          <p style={{ fontSize: 12, color: T.inkFaint, lineHeight: 1.6, margin: 0 }}>
            // 可以问任何关于本周计划的问题，例如：「为什么周三是阈值跑」「腿酸，能换 LSD 吗」。
          </p>
        )}
        {items.map((item) => (
          item.kind === 'persisted'
            ? <PersistedBubble key={item.message.id} message={item.message} />
            : <DraftBubble key={item.draft.id} draft={item.draft} />
        ))}
        {streaming && !draft && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.mono, fontSize: 11, color: T.inkFaint, paddingLeft: 4 }}>
            <span className="track-blink" style={{ width: 6, height: 6, background: T.lime, borderRadius: 999, display: 'inline-block' }} />
            <span>教练正在回复…</span>
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
          placeholder={streaming ? '正在等待回复…' : '问问你的 AI 教练（Enter 发送，Shift+Enter 换行）'}
          style={{ resize: 'none', fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1 }}>
            ⏎ 发送 · ⇧⏎ 换行
          </span>
          <Btn size="sm" onClick={() => void handleSend()} disabled={streaming || composerValue.trim().length === 0}>
            发送 ↵
          </Btn>
        </div>
      </div>
    </Card>
  );
}

function PersistedBubble({ message }: { message: TrainingChatMessage }) {
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
    const tcs = (message.toolCalls ?? []) as UiToolCall[] | null;
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{
          maxWidth: '92%', padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
          fontSize: 13, color: T.ink, lineHeight: 1.6,
        }}>
          {message.content && (
            <div className="track-md">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
          {tcs && tcs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {tcs.map((tc, i) => <ToolPill key={i} tc={tc} />)}
            </div>
          )}
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, marginTop: 6 }}>
            {formatTime(message.createdAt)} · 教练
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function DraftBubble({ draft }: { draft: DraftAssistant }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
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
            ● 教练正在思考…
          </div>
        )}
        {draft.toolCalls.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {draft.toolCalls.map((tc, i) => <ToolPill key={i} tc={tc} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolPill({ tc }: { tc: UiToolCall }) {
  const label = TOOL_LABELS[tc.name] ?? tc.name;
  const summary = summarizeToolCall(tc);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: T.mono, fontSize: 11, padding: '4px 8px', borderRadius: 4,
      background: 'rgba(95,216,255,0.06)', border: `1px solid ${T.cyan}40`,
      color: T.cyan, letterSpacing: 0.5,
    }}>
      <span aria-hidden>🔧</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {summary && <span style={{ color: T.inkDim }}>· {summary}</span>}
    </span>
  );
}

function summarizeToolCall(tc: UiToolCall): string | null {
  if (tc.name === 'regenerate_day') {
    const di = tc.arguments.dayIndex;
    if (typeof di === 'number') return `第 ${di} 天`;
    return null;
  }
  if (tc.name === 'update_workout_field') {
    const value = tc.arguments.value;
    if (typeof value === 'string') return STATUS_ZH[value] ?? value;
    return null;
  }
  return null;
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
    case 'llm_not_configured': return 'AI 模型尚未配置，请联系管理员。';
    case 'persist_user_message_failed': return '保存用户消息失败，请重试。';
    case 'persist_assistant_message_failed': return '保存助手回复失败，请重试。';
    case 'plan_request_corrupt': return '该计划记录已损坏，无法继续对话。';
    case 'not_found': return '计划不存在或不属于当前账号。';
    case 'chat_failed':
    default: return '对话失败，请稍后重试。';
  }
}
