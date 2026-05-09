'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getTrainingPlan,
  patchTrainingWorkout,
  trainingDayRegenerateUrl,
  type PlanStatus,
  type TrainingPlanDetail,
  type TrainingWorkout,
  type WorkoutStatus,
} from '@/lib/api';
import { streamSse, type SseEvent } from '@/lib/sse';
import { WorkoutCard } from './_components/WorkoutCard';
import { ChatPanel } from './_components/ChatPanel';

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  generating: '生成中',
  ready: '就绪',
  failed: '失败',
  archived: '已归档',
};

const PLAN_STATUS_CLASS: Record<PlanStatus, string> = {
  generating: 'bg-blue-100 text-blue-700',
  ready: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  archived: 'bg-zinc-100 text-zinc-500',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatWeekStart(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日（${WEEKDAYS[date.getDay()]}）`;
}

export default function TrainingPlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const planId = params?.planId ?? '';

  const [detail, setDetail] = useState<TrainingPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyWorkoutId, setBusyWorkoutId] = useState<string | null>(null);
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!planId) return;
    try {
      const d = await getTrainingPlan(planId);
      setDetail(d);
      setNotFound(false);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 404) {
        setNotFound(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      regenAbortRef.current?.abort();
    },
    [],
  );

  function highlight(dayIndex: number) {
    setHighlightedDay(dayIndex);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedDay(null), 2000);
  }

  async function changeStatus(workoutId: string, status: WorkoutStatus) {
    setBusyWorkoutId(workoutId);
    setError(null);
    try {
      const updated = await patchTrainingWorkout(workoutId, { status });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              workouts: prev.workouts.map((w) =>
                w.id === workoutId ? { ...w, ...updated, status } : w,
              ),
            }
          : prev,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyWorkoutId(null);
    }
  }

  async function regenerateDay(workout: TrainingWorkout) {
    if (!planId) return;
    setBusyWorkoutId(workout.id);
    setError(null);
    const ctrl = new AbortController();
    regenAbortRef.current = ctrl;
    let fatal: string | null = null;

    try {
      await streamSse({
        url: trainingDayRegenerateUrl(planId),
        body: { dayIndex: workout.dayIndex, reason: '' },
        signal: ctrl.signal,
        onEvent: (ev: SseEvent) => {
          const data = (ev.data ?? null) as Record<string, unknown> | null;
          if (ev.event === 'error') {
            fatal =
              data && typeof data.error === 'string'
                ? (data.error as string)
                : '重新生成失败';
          }
          // We don't need to merge the partial workout here — once 'done' fires
          // we refetch the plan, which is simpler and gets us the canonical row.
        },
      });
    } catch (e) {
      fatal = (e as Error).message || '重新生成失败';
    }

    if (fatal) {
      setError(fatal);
      setBusyWorkoutId(null);
      return;
    }

    await refresh();
    setBusyWorkoutId(null);
    highlight(workout.dayIndex);
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">加载中…</p>;
  }
  if (notFound) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">计划不存在</h1>
        <p className="text-sm text-zinc-500">
          这份计划可能已被删除，或不属于当前账号。
        </p>
        <Link
          href="/training"
          className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          返回列表
        </Link>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? '加载失败'}
      </div>
    );
  }

  const { plan, workouts } = detail;
  const ordered = [...workouts].sort((a, b) => a.dayIndex - b.dayIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <Link href="/training" className="hover:text-zinc-900">
          ← 返回列表
        </Link>
      </div>

      <header className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {formatWeekStart(plan.weekStartDate)}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              创建于 {new Date(plan.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${PLAN_STATUS_CLASS[plan.status]}`}
          >
            {PLAN_STATUS_LABEL[plan.status]}
          </span>
        </div>
        {plan.summary && (
          <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed">
            {plan.summary}
          </p>
        )}
        {(plan.monitoring || plan.adjustmentRules) && (
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            {plan.monitoring && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3">
                <div className="text-xs text-zinc-500 mb-1">监测建议</div>
                <p className="text-sm text-zinc-800 whitespace-pre-line leading-relaxed">
                  {plan.monitoring}
                </p>
              </div>
            )}
            {plan.adjustmentRules && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3">
                <div className="text-xs text-zinc-500 mb-1">调整规则</div>
                <p className="text-sm text-zinc-800 whitespace-pre-line leading-relaxed">
                  {plan.adjustmentRules}
                </p>
              </div>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">本周训练</h2>
          {ordered.length === 0 ? (
            <p className="text-sm text-zinc-500">暂无训练日。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ordered.map((w) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  highlighted={highlightedDay === w.dayIndex}
                  busy={busyWorkoutId === w.id}
                  onComplete={() => changeStatus(w.id, 'completed')}
                  onSkip={() => changeStatus(w.id, 'skipped')}
                  onRegenerate={() => regenerateDay(w)}
                />
              ))}
            </div>
          )}
        </section>

        <aside>
          <ChatPanel
            planId={planId}
            initialMessages={detail.messages}
            onWorkoutUpdated={(w) => {
              setDetail((prev) =>
                prev
                  ? {
                      ...prev,
                      workouts: prev.workouts.map((row) =>
                        row.id === w.id ? { ...row, ...w } : row,
                      ),
                    }
                  : prev,
              );
              highlight(w.dayIndex);
            }}
            onWorkoutFieldUpdated={(workoutId, field, value) => {
              if (field !== 'status') return;
              setDetail((prev) =>
                prev
                  ? {
                      ...prev,
                      workouts: prev.workouts.map((row) =>
                        row.id === workoutId
                          ? { ...row, status: value as WorkoutStatus }
                          : row,
                      ),
                    }
                  : prev,
              );
            }}
          />
        </aside>
      </div>
    </div>
  );
}
