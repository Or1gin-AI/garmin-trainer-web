'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  deleteTrainingPlan,
  getTrainingPlan,
  patchTrainingWorkout,
  trainingDayRegenerateUrl,
  trainingPlanExportUrl,
  type PlanStatus,
  type Sport,
  type TrainingPlanDetail,
  type TrainingWorkout,
  type WorkoutStatus,
} from '@/lib/api';
import { streamSse, type SseEvent } from '@/lib/sse';
import {
  T, Btn, Card, StatTile, StatusBadge, PageHero, Banner, Pill, LABEL,
  type StatusKind,
} from '@/components/track';
import { WorkoutCard } from './_components/WorkoutCard';
import { ChatPanel } from './_components/ChatPanel';
import {
  WeekCalendar,
  toCalendarCell,
  type CalendarDay,
  type CalendarCellWorkout,
} from '@/components/training/WeekCalendar';
import { formatMinutes, formatWeekRange, weekRelation } from '@/lib/format';
import { readPlanEstimatedTrainingLoad, sumWorkoutEstimatedTrainingLoad } from '@/lib/training-load';
import { useGarminPublish, GARMIN_REGIONS } from './_components/useGarminPublish';
import { ConfirmDialog } from './_components/ConfirmDialog';

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

const EXPORT_FORMATS = [
  { key: 'intervals_icu', label: 'Intervals.icu' },
  { key: 'pdf', label: 'PDF' },
  { key: 'word', label: 'Word' },
  { key: 'excel', label: 'Excel' },
] as const;

function todayDayIndex(weekStartDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartDate);
  if (!m) return null;
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0 || diff > 6) return null;
  return diff + 1;
}

/** Split a paragraph of coach guidance into short bullet points. */
function toBullets(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?。！？；;])\s+|(?<=[。！？；;])|\n+/)
    .map((s) => s.trim().replace(/^[-•·]\s*/, ''))
    .filter((s) => s.length > 1);
}

type PlanRequest = { goal?: string | null; daysPerWeek?: number | null; raceDate?: string | null; goalDistance?: string | null };

export default function TrainingPlanDetailPage() {
  const router = useRouter();
  const params = useParams<{ planId: string }>();
  const planId = params?.planId ?? '';

  const [detail, setDetail] = useState<TrainingPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyWorkoutId, setBusyWorkoutId] = useState<string | null>(null);
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [confirmLocalDelete, setConfirmLocalDelete] = useState(false);
  const [localDeleteBusy, setLocalDeleteBusy] = useState(false);
  const [openActionPanel, setOpenActionPanel] = useState<'export' | 'garmin' | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenAbortRef = useRef<AbortController | null>(null);
  const actionPanelRef = useRef<HTMLDivElement | null>(null);

  const garmin = useGarminPublish(planId);

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

  useEffect(() => {
    if (!openActionPanel) return;
    function handleClick(e: MouseEvent) {
      if (actionPanelRef.current?.contains(e.target as Node)) return;
      setOpenActionPanel(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openActionPanel]);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      regenAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!detail || selectedDay != null) return;
    const today = todayDayIndex(detail.plan.weekStartDate);
    const firstTraining = [...detail.workouts]
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .find((w) => w.sport !== 'rest')?.dayIndex;
    setSelectedDay(today ?? firstTraining ?? detail.workouts[0]?.dayIndex ?? 1);
  }, [detail, selectedDay]);

  function highlight(dayIndex: number) {
    setHighlightedDay(dayIndex);
    setSelectedDay(dayIndex);
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
        body: { dayIndex: workout.dayIndex, slotIndex: workout.slotIndex ?? 1, reason: '' },
        signal: ctrl.signal,
        onEvent: (ev: SseEvent) => {
          const data = (ev.data ?? null) as Record<string, unknown> | null;
          if (ev.event === 'error') {
            fatal = data && typeof data.error === 'string' ? (data.error as string) : 'Regeneration failed';
          }
        },
      });
    } catch (e) {
      fatal = (e as Error).message || 'Regeneration failed';
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

  async function deleteLocalPlan() {
    if (!planId || localDeleteBusy) return;
    setLocalDeleteBusy(true);
    setError(null);
    try {
      await deleteTrainingPlan(planId);
      router.push('/training');
    } catch (e) {
      const err = e as ApiError;
      const d = err.detail as { error?: string; activeCount?: number } | undefined;
      setError(
        d?.error === 'garmin_plan_uploaded'
          ? `This plan still has ${d.activeCount ?? 0} workout(s) on your Garmin calendar. Remove them from Garmin before deleting the plan.`
          : err.message,
      );
      setConfirmLocalDelete(false);
    } finally {
      setLocalDeleteBusy(false);
    }
  }

  const calendarDays: CalendarDay[] | null = useMemo(() => {
    if (!detail) return null;
    const firstByDay = new Map<number, TrainingWorkout>();
    for (const w of detail.workouts) {
      if (!firstByDay.has(w.dayIndex)) firstByDay.set(w.dayIndex, w);
    }
    return Array.from(firstByDay.values()).map((w) => ({
      dayIndex: w.dayIndex,
      date: w.date,
      sport: w.sport as Sport,
    }));
  }, [detail]);

  const calendarWorkouts: Map<number, CalendarCellWorkout[]> = useMemo(() => {
    const m = new Map<number, CalendarCellWorkout[]>();
    if (!detail) return m;
    for (const w of detail.workouts) {
      const list = m.get(w.dayIndex) ?? [];
      list.push(toCalendarCell(w));
      m.set(w.dayIndex, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => (a.slotIndex ?? 1) - (b.slotIndex ?? 1));
    }
    return m;
  }, [detail]);

  if (loading) {
    return (
      <div style={{ fontSize: 14, color: T.inkFaint }} className="track-blink">
        Loading plan…
      </div>
    );
  }
  if (notFound) {
    return (
      <Card style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ ...LABEL, color: T.red, marginBottom: 10 }}>Not found</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: T.ink }}>Plan not found</h2>
        <p style={{ color: T.inkDim, fontSize: 14, margin: '0 0 20px' }}>This plan may have been deleted, or it belongs to another account.</p>
        <Link href="/training" style={{ textDecoration: 'none' }}>
          <Btn>Back to plans</Btn>
        </Link>
      </Card>
    );
  }
  if (!detail) {
    return (
      <Banner kind="error" code="ERR">{error ?? 'Could not load this plan.'}</Banner>
    );
  }

  const { plan, workouts } = detail;
  const request = (plan.request ?? {}) as PlanRequest;
  const ordered = [...workouts].sort((a, b) => a.dayIndex - b.dayIndex || (a.slotIndex ?? 1) - (b.slotIndex ?? 1));
  const sessions = ordered.filter((w) => w.sport !== 'rest');
  const completed = sessions.filter((w) => w.status === 'completed').length;
  const totalMin = ordered.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);
  const hardCount = sessions.filter((w) => w.intensity === 'high').length;
  const estimatedTrainingLoad =
    readPlanEstimatedTrainingLoad(plan.modelMeta) ?? sumWorkoutEstimatedTrainingLoad(ordered);
  const trainingDayCount = new Set(
    ordered
      .filter((w) => w.sport !== 'rest' && w.sport !== 'mobility')
      .map((w) => w.dayIndex),
  ).size;
  const selected = selectedDay != null ? ordered.filter((w) => w.dayIndex === selectedDay) : [];
  const rel = weekRelation(plan.weekStartDate);

  const uploaded = garmin.status?.uploaded ?? false;
  const garminRegion = GARMIN_REGIONS.find((r) => r.key === garmin.region) ?? GARMIN_REGIONS[0];

  const monitoring = toBullets(plan.monitoring);
  const rules = toBullets(plan.adjustmentRules);

  const subParts = [
    request.goal ? `Goal: ${request.goal}` : null,
    request.daysPerWeek ? `${request.daysPerWeek} days per week` : null,
    `Created ${new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  ].filter(Boolean);

  const popoverStyle = {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    right: 0,
    width: 300,
    padding: 16,
    zIndex: 50,
    background: T.panelRaised,
    border: `1px solid ${T.borderHot}`,
    boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/training" className="track-link" style={{ fontSize: 13, fontWeight: 500 }}>
          ← All plans
        </Link>
      </div>

      <PageHero
        eyebrow={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            Weekly plan
            {rel === 'current' && <Pill color={T.lime} size="sm" solid style={{ letterSpacing: 0, textTransform: 'none' }}>This week</Pill>}
            {rel === 'upcoming' && <Pill color={T.cyan} size="sm" style={{ letterSpacing: 0, textTransform: 'none' }}>Upcoming</Pill>}
          </span>
        }
        title={formatWeekRange(plan.weekStartDate)}
        sub={subParts.join(' · ')}
        actions={
          <>
            <StatusBadge kind={STATUS_MAP[plan.status]} />
            <Link href="/calendar" style={{ textDecoration: 'none' }}>
              <Btn variant="ghost" size="sm">View calendar</Btn>
            </Link>
            <div ref={actionPanelRef} style={{ position: 'relative', display: 'flex', gap: 8 }}>
              <Btn
                variant={openActionPanel === 'export' ? 'ok' : 'ghost'}
                size="sm"
                onClick={() => setOpenActionPanel((v) => (v === 'export' ? null : 'export'))}
              >
                Export ▾
              </Btn>
              <Btn
                size="sm"
                onClick={() => setOpenActionPanel((v) => (v === 'garmin' ? null : 'garmin'))}
              >
                {uploaded ? '✓ On Garmin' : 'Send to Garmin'}
              </Btn>

              {openActionPanel === 'export' && (
                <Card style={{ ...popoverStyle, right: 120, width: 260 }}>
                  <div style={{ ...LABEL, marginBottom: 10 }}>Export as</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {EXPORT_FORMATS.map((f) => (
                      <Btn
                        key={f.key}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          window.location.href = trainingPlanExportUrl(planId, f.key);
                          setOpenActionPanel(null);
                        }}
                      >
                        {f.label}
                      </Btn>
                    ))}
                  </div>
                </Card>
              )}

              {openActionPanel === 'garmin' && (
                <Card style={popoverStyle}>
                  <div style={{ ...LABEL, marginBottom: 10 }}>Upload workouts to</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                    {GARMIN_REGIONS.map((r) => (
                      <Btn
                        key={r.key}
                        variant={garmin.region === r.key ? 'ok' : 'ghost'}
                        size="sm"
                        onClick={() => garmin.setRegion(r.key)}
                        disabled={garmin.busy !== null}
                      >
                        {r.name}
                      </Btn>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.55, marginBottom: 14 }}>
                    Structured workouts are added to your {garminRegion.name} calendar and sync to your watch.
                    {garmin.status && (
                      <div style={{ marginTop: 6, color: uploaded ? T.green : T.inkFaint }}>
                        {uploaded ? `${garmin.status.scheduled} workout(s) on Garmin` : 'Not uploaded yet'}
                        {garmin.status.failed > 0 ? ` · ${garmin.status.failed} failed` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn
                      size="sm"
                      onClick={() => {
                        void garmin.push();
                        setOpenActionPanel(null);
                      }}
                      disabled={plan.status !== 'ready' || garmin.busy !== null}
                      style={{ flex: 1 }}
                    >
                      {garmin.busy === 'push' ? 'Uploading…' : uploaded ? 'Upload again' : 'Upload'}
                    </Btn>
                    {uploaded && (
                      <Btn
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          garmin.setConfirmDelete(true);
                          setOpenActionPanel(null);
                        }}
                        disabled={garmin.busy !== null}
                      >
                        Remove
                      </Btn>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </>
        }
      />

      {(error || garmin.error) && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error || garmin.error}</Banner>
        </div>
      )}

      {garmin.notice && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="ok" code="Garmin">{garmin.notice}</Banner>
        </div>
      )}

      {garmin.confirmDelete && (
        <ConfirmDialog
          eyebrow="Garmin"
          title={`Remove this plan from ${garminRegion.name}?`}
          description={`This removes the ${garmin.status?.activeCount ?? 0} workout(s) Garmin Trainer added to your ${garminRegion.name} calendar. Your plan here is kept.`}
          confirmLabel={garmin.busy === 'delete' ? 'Removing…' : 'Remove from Garmin'}
          confirmVariant="danger"
          busy={garmin.busy === 'delete'}
          onCancel={() => garmin.setConfirmDelete(false)}
          onConfirm={garmin.remove}
        />
      )}

      {confirmLocalDelete && (
        <ConfirmDialog
          eyebrow="Delete plan"
          title="Delete this training plan?"
          description="This deletes the plan, its workouts and the coach conversation. If the plan was uploaded to Garmin, remove it from Garmin first."
          confirmLabel={localDeleteBusy ? 'Deleting…' : 'Delete plan'}
          confirmVariant="danger"
          busy={localDeleteBusy}
          onCancel={() => setConfirmLocalDelete(false)}
          onConfirm={deleteLocalPlan}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatTile
          label="Sessions done"
          value={`${completed}`}
          unit={`/ ${sessions.length}`}
          accent={T.lime}
          delta={sessions.length > 0 ? `${Math.round((completed / sessions.length) * 100)}%` : undefined}
          tone="ok"
        />
        <StatTile label="Training time" value={formatMinutes(totalMin)} accent={T.cyan} hint="Total planned this week" />
        <StatTile label="Training days" value={`${trainingDayCount}`} unit="days" accent={T.amber} hint={`${7 - trainingDayCount} rest or recovery days`} />
        <StatTile label="Hard sessions" value={`${hardCount}`} accent={T.red} hint="Threshold, intervals, VO₂max" />
        {estimatedTrainingLoad != null && (
          <StatTile label="Est. training load" value={String(estimatedTrainingLoad)} accent={T.violet} hint="Garmin acute load units" />
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '999 1 640px' }}>
          {(plan.summary || monitoring.length > 0 || rules.length > 0) && (
            <Card style={{ padding: 22, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span aria-hidden="true" style={{
                  width: 28, height: 28, borderRadius: 999, background: T.limeGlow, color: T.lime,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800,
                }}>✦</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>Coach&apos;s overview</div>
              </div>
              {plan.summary && (
                <p style={{ margin: '0 0 16px', fontSize: 15, color: T.ink, lineHeight: 1.7 }}>{plan.summary}</p>
              )}
              {(monitoring.length > 0 || rules.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {monitoring.length > 0 && (
                    <GuidanceBox title="What to watch" color={T.cyan} icon="◉">
                      {monitoring}
                    </GuidanceBox>
                  )}
                  {rules.length > 0 && (
                    <GuidanceBox title="When to adjust" color={T.amber} icon="⇅">
                      {rules}
                    </GuidanceBox>
                  )}
                </div>
              )}
            </Card>
          )}

          <Card style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>Week at a glance</div>
              <div style={{ fontSize: 12, color: T.inkFaint }}>Select a day to see the full session</div>
            </div>
            <WeekCalendar
              days={calendarDays}
              workouts={calendarWorkouts}
              mode="detail"
              selectedDayIndex={selectedDay ?? undefined}
              highlightedDayIndex={highlightedDay ?? undefined}
              onSelectDay={(idx) => setSelectedDay(idx)}
            />
          </Card>

          <div style={{ marginBottom: 24 }}>
            {selected.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {selected.map((item) => (
                  <WorkoutCard
                    key={item.id}
                    workout={item}
                    highlighted={highlightedDay === item.dayIndex}
                    busy={busyWorkoutId === item.id}
                    onComplete={() => changeStatus(item.id, 'completed')}
                    onSkip={() => changeStatus(item.id, 'skipped')}
                    onRegenerate={() => regenerateDay(item)}
                  />
                ))}
              </div>
            ) : (
              <Card style={{ padding: 32, textAlign: 'center', color: T.inkFaint, fontSize: 14 }}>
                Select a day above to see the session details.
              </Card>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="danger" size="sm" onClick={() => setConfirmLocalDelete(true)}>Delete plan</Btn>
          </div>
        </div>

        <div style={{ flex: '1 1 340px', maxWidth: '100%', position: 'sticky', top: 88, maxHeight: 'calc(100vh - 112px)' }}>
          <ChatPanel
            planId={planId}
            initialMessages={detail.messages}
            onWorkoutUpdated={(w) => {
              setDetail((prev) => {
                if (!prev) return prev;
                const exists = prev.workouts.some((row) => row.id === w.id);
                const wk = (exists
                  ? prev.workouts.map((row) => (row.id === w.id ? { ...row, ...w } : row))
                  : [...prev.workouts, w]
                ).sort((a, b) => a.dayIndex - b.dayIndex || (a.slotIndex ?? 1) - (b.slotIndex ?? 1));
                return { ...prev, workouts: wk };
              });
              highlight(w.dayIndex);
            }}
          />
        </div>
      </div>
    </>
  );
}

function GuidanceBox({ title, color, icon, children }: { title: string; color: string; icon: string; children: string[] }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: `${color}0d`, border: `1px solid ${color}26`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 700, color }}>
        <span aria-hidden="true">{icon}</span>{title}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {children.map((line, i) => (
          <Bullet key={i} color={color}>{line}</Bullet>
        ))}
      </ul>
    </div>
  );
}

function Bullet({ color, children }: { color: string; children: ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 9, fontSize: 13, lineHeight: 1.6, color: T.inkDim }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: color, marginTop: 8, flexShrink: 0 }} />
      <span>{children}</span>
    </li>
  );
}
