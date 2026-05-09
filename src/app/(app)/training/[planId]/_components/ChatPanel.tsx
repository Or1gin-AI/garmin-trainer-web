'use client';

// AI coach chat panel (U10).
//
// Streams a single SSE turn at a time:
//   user_message_saved  -> swap optimistic user bubble with the persisted row
//   text_delta          -> append into the in-progress assistant bubble
//   tool_call           -> attach a tool-call pill to the in-progress bubble
//   workout_updated     -> bubble up to the parent so the matching card refreshes
//   assistant_message_saved -> finalize the assistant bubble with its server id
//   error / done        -> close the stream and re-enable the composer
//
// Composer is locked while a stream is in flight. Auto-scroll on each update.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  trainingChatStreamUrl,
  type TrainingChatMessage,
  type TrainingWorkout,
} from '@/lib/api';
import { streamSse, type SseEvent } from '@/lib/sse';

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

// In-flight assistant bubble shape. Once persisted, swap into TrainingChatMessage.
interface DraftAssistant {
  id: string; // local-only until assistant_message_saved fires
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
  onWorkoutFieldUpdated: (
    workoutId: string,
    field: string,
    value: string,
  ) => void;
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

  // Sync external messages (e.g. parent refresh) when caller updates the list.
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const items: ListItem[] = useMemo(() => {
    const out: ListItem[] = messages.map((m) => ({ kind: 'persisted', message: m }));
    if (draft) out.push({ kind: 'draft', draft });
    return out;
  }, [messages, draft]);

  // Auto-scroll on new content.
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

    // Optimistic user bubble.
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

    // In-progress assistant bubble (created lazily on first text_delta).
    let draftId = '';
    const ensureDraft = () => {
      if (!draftId) {
        draftId = `draft-${Date.now()}`;
        setDraft({
          id: draftId,
          content: '',
          toolCalls: [],
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
            setMessages((prev) =>
              prev.map((m) => (m.id === optimisticId ? persisted : m)),
            );
            return;
          }

          if (ev.event === 'text_delta') {
            const piece = typeof data.text === 'string' ? data.text : '';
            if (!piece) return;
            ensureDraft();
            setDraft((prev) =>
              prev ? { ...prev, content: prev.content + piece } : prev,
            );
            return;
          }

          if (ev.event === 'tool_call') {
            ensureDraft();
            const name = typeof data.name === 'string' ? data.name : 'unknown';
            const args =
              data.arguments && typeof data.arguments === 'object'
                ? (data.arguments as Record<string, unknown>)
                : {};
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    toolCalls: [...prev.toolCalls, { name, arguments: args }],
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
              typeof data.error === 'string'
                ? mapErrorCode(data.error)
                : '对话失败，请稍后重试';
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

  // Touch onWorkoutFieldUpdated so the lint rule for unused props is happy
  // even though the backend currently routes status updates through the same
  // `workout_updated` event; we still expose the callback for parity with the
  // route handler shape and future use.
  void onWorkoutFieldUpdated;

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-3 max-h-[calc(100vh-8rem)] sticky top-4">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold">AI 教练对话</h3>
        {streaming && <span className="text-xs text-emerald-600">教练正在回复…</span>}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[20rem]"
      >
        {items.length === 0 && (
          <p className="text-xs text-zinc-400 leading-relaxed">
            可以问任何关于本周计划的问题，例如「为什么周三是阈值跑」「腿酸,周三能换 LSD 吗」。
          </p>
        )}
        {items.map((item) => {
          if (item.kind === 'persisted') {
            return <PersistedBubble key={item.message.id} message={item.message} />;
          }
          return <DraftBubble key={item.draft.id} draft={item.draft} />;
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={composerValue}
          onChange={(e) => setComposerValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={streaming}
          placeholder={streaming ? '正在等待回复…' : '问问你的 AI 教练（Enter 发送）'}
          rows={2}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-50 disabled:text-zinc-400 resize-none"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={streaming || composerValue.trim().length === 0}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            发送
          </button>
        </div>
      </div>
    </section>
  );
}

function PersistedBubble({ message }: { message: TrainingChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-zinc-100 text-zinc-900 px-3 py-2 text-sm whitespace-pre-wrap">
          {message.content}
          <div className="text-[10px] text-zinc-400 mt-1 text-right">
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }
  if (message.role === 'assistant') {
    const tcs = (message.toolCalls ?? []) as UiToolCall[] | null;
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-emerald-50 border border-emerald-100 text-zinc-900 px-3 py-2 text-sm space-y-2">
          {message.content && (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
          {tcs && tcs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tcs.map((tc, i) => (
                <ToolPill key={i} tc={tc} />
              ))}
            </div>
          )}
          <div className="text-[10px] text-emerald-700/60">
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }
  // 'tool' messages aren't rendered directly — they're already represented by
  // their parent assistant turn's pills + workout_updated callback.
  return null;
}

function DraftBubble({ draft }: { draft: DraftAssistant }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-emerald-50 border border-emerald-100 text-zinc-900 px-3 py-2 text-sm space-y-2">
        {draft.content.length > 0 ? (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-li:my-0">
            <ReactMarkdown>{draft.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-xs text-emerald-700/70">教练正在思考…</div>
        )}
        {draft.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {draft.toolCalls.map((tc, i) => (
              <ToolPill key={i} tc={tc} />
            ))}
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
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] text-emerald-800">
      <span aria-hidden>🔧</span>
      <span className="font-medium">{label}</span>
      {summary && <span className="text-emerald-700/80">· {summary}</span>}
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
    if (typeof value === 'string') {
      return STATUS_ZH[value] ?? value;
    }
    return null;
  }
  return null;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0',
    )}`;
  } catch {
    return '';
  }
}

function mapErrorCode(code: string): string {
  switch (code) {
    case 'llm_not_configured':
      return 'AI 模型尚未配置，请联系管理员。';
    case 'persist_user_message_failed':
      return '保存用户消息失败，请重试。';
    case 'persist_assistant_message_failed':
      return '保存助手回复失败，请重试。';
    case 'plan_request_corrupt':
      return '该计划记录已损坏，无法继续对话。';
    case 'not_found':
      return '计划不存在或不属于当前账号。';
    case 'chat_failed':
    default:
      return '对话失败，请稍后重试。';
  }
}

