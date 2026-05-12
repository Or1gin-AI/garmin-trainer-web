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
import {
  T, Btn, Card, CardHeader, StatTile, SectionLabel, StatusBadge, PageHero, Banner,
  type StatusKind,
} from '@/components/track';
import { WorkoutCard } from './_components/WorkoutCard';
import { ChatPanel } from './_components/ChatPanel';

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatWeekStart(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]} · ${Number(m[2])}月${Number(m[3])}日 ${WEEKDAYS[date.getDay()]}`;
}

function planShortId(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`;
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
      if (err.status === 404) setNotFound(true);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { refresh(); }, [refresh]);

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
            fatal = data && typeof data.error === 'string' ? (data.error as string) : '重新生成失败';
          }
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
    return (
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
        // 加载中…
      </div>
    );
  }
  if (notFound) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.red, letterSpacing: 1.5, marginBottom: 8 }}>// 404 · 未找到</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, color: T.ink }}>计划不存在</h2>
        <p style={{ color: T.inkDim, fontSize: 13, margin: '0 0 18px' }}>这份计划可能已被删除，或不属于当前账号。</p>
        <Link href="/training" style={{ textDecoration: 'none' }}>
          <Btn>返回列表</Btn>
        </Link>
      </Card>
    );
  }
  if (!detail) {
    return (
      <Banner kind="error" code="ERR">{error ?? '加载失败'}</Banner>
    );
  }

  const { plan, workouts } = detail;
  const ordered = [...workouts].sort((a, b) => a.dayIndex - b.dayIndex);
  const completed = ordered.filter((w) => w.status === 'completed').length;
  const totalKm = ordered.reduce((s, w) => s + (Number(w.distanceKm) || 0), 0);
  const totalMin = ordered.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <Link href="/training" className="track-link" style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2 }}>
          ← 返回列表
        </Link>
      </div>

      <PageHero
        eyebrow={`// 计划 ${planShortId(plan.id)} · 本周`}
        title={formatWeekStart(plan.weekStartDate)}
        sub={`创建于 ${new Date(plan.createdAt).toLocaleString('zh-CN')}`}
        actions={
          <>
            <StatusBadge kind={STATUS_MAP[plan.status]} />
            <Link href="/training/new" style={{ textDecoration: 'none' }}>
              <Btn variant="ghost" size="sm">+ 新计划</Btn>
            </Link>
          </>
        }
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatTile label="已完成" value={`${completed}`} unit={`/ ${ordered.length}`} accent={T.lime} delta={ordered.length > 0 ? `${Math.round((completed / ordered.length) * 100)}%` : undefined} tone="ok" />
        <StatTile label="本周公里" value={totalKm.toFixed(1)} unit="公里" accent={T.cyan} />
        <StatTile label="本周时长" value={String(totalMin)} unit="分钟" accent={T.cyan} />
        <StatTile label="训练日" value={`${ordered.length}`} unit="次" accent={T.amber} />
      </div>

      {(plan.summary || plan.monitoring || plan.adjustmentRules) && (
        <Card style={{ padding: 22, marginBottom: 24 }}>
          <CardHeader eyebrow="// 本周概要" title="本周概要" />
          {plan.summary && (
            <p style={{ marginTop: 14, fontSize: 13, color: T.ink, lineHeight: 1.75, whiteSpace: 'pre-line' }}>
              {plan.summary}
            </p>
          )}
          {(plan.monitoring || plan.adjustmentRules) && (
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: plan.monitoring && plan.adjustmentRules ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 12 }}>
              {plan.monitoring && (
                <div style={{ padding: 14, background: 'rgba(0,0,0,0.25)', border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan, letterSpacing: 1.5, marginBottom: 6 }}>监测重点</div>
                  <p style={{ margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{plan.monitoring}</p>
                </div>
              )}
              {plan.adjustmentRules && (
                <div style={{ padding: 14, background: 'rgba(0,0,0,0.25)', border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.amber, letterSpacing: 1.5, marginBottom: 6 }}>调整规则</div>
                  <p style={{ margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{plan.adjustmentRules}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: 18 }}>
        <div>
          <SectionLabel>本周训练</SectionLabel>
          {ordered.length === 0 ? (
            <Card style={{ padding: 32, textAlign: 'center', color: T.inkFaint, fontSize: 13 }}>
              暂无训练日。
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        </div>

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
      </div>
    </>
  );
}
