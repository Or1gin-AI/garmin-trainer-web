'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  T, Btn, Card, StatTile, StatusBadge, PageHero, Banner,
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
import { formatWeekStart } from '@/lib/format';
import { readPlanEstimatedTrainingLoad, sumWorkoutEstimatedTrainingLoad } from '@/lib/training-load';
import { useGarminPublish, garminRegionLabel, GARMIN_REGIONS } from './_components/useGarminPublish';
import { ConfirmDialog } from './_components/ConfirmDialog';

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

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
    const first = detail.workouts[0]?.dayIndex ?? 1;
    setSelectedDay(today ?? first);
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
          ? `This plan still has ${d.activeCount ?? 0}  Garmin remote copy. Delete the remote copy from CN/International Garmin before deleting the local plan.`
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
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
        Loading…
      </div>
    );
  }
  if (notFound) {
    return (
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.red, letterSpacing: 1.5, marginBottom: 8 }}>404 · Not found</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, color: T.ink }}>Plan not found</h2>
        <p style={{ color: T.inkDim, fontSize: 13, margin: '0 0 18px' }}>This plan may have been deleted or does not belong to the current account.</p>
        <Link href="/training" style={{ textDecoration: 'none' }}>
          <Btn>Backlist</Btn>
        </Link>
      </Card>
    );
  }
  if (!detail) {
    return (
      <Banner kind="error" code="ERR">{error ?? 'Loading failed'}</Banner>
    );
  }

  const { plan, workouts } = detail;
  const ordered = [...workouts].sort((a, b) => a.dayIndex - b.dayIndex || (a.slotIndex ?? 1) - (b.slotIndex ?? 1));
  const completed = ordered.filter((w) => w.status === 'completed').length;
  const totalMin = ordered.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);
  const estimatedTrainingLoad =
    readPlanEstimatedTrainingLoad(plan.modelMeta) ?? sumWorkoutEstimatedTrainingLoad(ordered);
  const trainingDayCount = new Set(
    ordered
      .filter((w) => w.sport !== 'rest' && w.sport !== 'mobility')
      .map((w) => w.dayIndex),
  ).size;
  const selected = selectedDay != null ? ordered.filter((w) => w.dayIndex === selectedDay) : [];

  const uploaded = garmin.status?.uploaded ?? false;
  const garminRegion = GARMIN_REGIONS.find((r) => r.key === garmin.region) ?? GARMIN_REGIONS[0];

  const EXPORT_FORMATS = [
    { key: 'intervals_icu', label: 'Intervals.icu Calendar' },
    { key: 'word', label: 'Word document' },
    { key: 'pdf', label: 'PDF' },
    { key: 'excel', label: 'Excel spreadsheet' },
  ] as const;

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <Link href="/training" className="track-link" style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2 }}>
          ← Backlist
        </Link>
      </div>

      <PageHero
        title={formatWeekStart(plan.weekStartDate)}
        sub={`Create  ${new Date(plan.createdAt).toLocaleString('en-US')}`}
        actions={
          <>
            <StatusBadge kind={STATUS_MAP[plan.status]} />
            <Link href="/calendar" style={{ textDecoration: 'none' }}>
              <Btn variant="ok" size="sm">Apply in Calendar</Btn>
            </Link>
            <div ref={actionPanelRef} style={{ position: 'relative', display: 'flex', gap: 8 }}>
              <Btn
                variant={openActionPanel === 'export' ? 'ok' : 'ghost'}
                size="sm"
                onClick={() => setOpenActionPanel((v) => (v === 'export' ? null : 'export'))}
              >
                Export
              </Btn>
              <Btn
                variant={openActionPanel === 'garmin' ? 'ok' : 'ghost'}
                size="sm"
                onClick={() => setOpenActionPanel((v) => (v === 'garmin' ? null : 'garmin'))}
              >
                Upload Garmin
              </Btn>

              {openActionPanel === 'export' && (
                <Card style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 110,
                  width: 280,
                  padding: 16,
                  zIndex: 50,
                  background: '#101410',
                  border: `1px solid ${T.borderHot}`,
                  boxShadow: '0 18px 50px rgba(0,0,0,0.72)',
                }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5, marginBottom: 10 }}>
                    Choose export format
                  </div>
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
                        style={{ justifyContent: 'center' }}
                      >
                        {f.label}
                      </Btn>
                    ))}
                  </div>
                </Card>
              )}

              {openActionPanel === 'garmin' && (
                <Card style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 310,
                  padding: 16,
                  zIndex: 50,
                  background: '#101410',
                  border: `1px solid ${T.borderHot}`,
                  boxShadow: '0 18px 50px rgba(0,0,0,0.72)',
                }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5, marginBottom: 10 }}>
                    Choose upload region
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                    {GARMIN_REGIONS.map((r) => (
                      <Btn
                        key={r.key}
                        variant={garmin.region === r.key ? 'ok' : 'ghost'}
                        size="sm"
                        onClick={() => garmin.setRegion(r.key)}
                        disabled={garmin.busy !== null}
                      >
                        {r.label}
                      </Btn>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.55, marginBottom: 12 }}>
                    Current goal: <span style={{ color: T.ink }}>{garminRegion.label}</span>
                    {garmin.status && (
                      <>
                        {' '}· {uploaded ? `Uploaded ${garmin.status.scheduled} ` : 'Not uploaded yet'}
                        {garmin.status.failed > 0 ? ` · Failed ${garmin.status.failed} ` : ''}
                      </>
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
                        Deleteremote
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
          <Banner kind="ok" code="GARMIN">{garmin.notice}</Banner>
        </div>
      )}

      {garmin.confirmDelete && (
        <ConfirmDialog
          eyebrow="GARMIN.DELETE"
          title={`from ${garminRegionLabel(garmin.region)} Garmin Delete this plan?`}
          description={`willDelete${garminRegionLabel(garmin.region)} Garmin Calendarcreated by Garmin Trainer ${garmin.status?.activeCount ?? 0} Training，Delete workout 。The local training plan will not be deleted.`}
          confirmLabel={garmin.busy === 'delete' ? 'Deleteing…' : 'ConfirmDelete'}
          confirmVariant="danger"
          busy={garmin.busy === 'delete'}
          onCancel={() => garmin.setConfirmDelete(false)}
          onConfirm={garmin.remove}
        />
      )}

      {confirmLocalDelete && (
        <ConfirmDialog
          eyebrow="PLAN.DELETE"
          title="Delete this local training plan?"
          description="This deletes the local plan, training schedule, and chat records.ifThis plan still has Garmin remote，systemDelete，Please from CN/International Garmin Delete。"
          confirmLabel={localDeleteBusy ? 'Deleteing…' : 'ConfirmDelete'}
          confirmVariant="danger"
          busy={localDeleteBusy}
          onCancel={() => setConfirmLocalDelete(false)}
          onConfirm={deleteLocalPlan}
        />
      )}

      {/* Two-column layout: main content + AI coach sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Left: main content */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatTile label="Completed" value={`${completed}`} unit={`/ ${ordered.length}`} accent={T.lime} delta={ordered.length > 0 ? `${Math.round((completed / ordered.length) * 100)}%` : undefined} tone="ok" />
            <StatTile label="Weekly duration" value={String(totalMin)} unit="minutes" accent={T.cyan} />
            <StatTile label="Training days" value={`${trainingDayCount}`} unit="days" accent={T.amber} />
            <StatTile label="Estimated training load" value={estimatedTrainingLoad == null ? '—' : String(estimatedTrainingLoad)} unit="Garmin" accent={T.lime} />
          </div>

          <Card style={{ padding: 18, marginBottom: 18 }}>
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
              <Card style={{ padding: 32, textAlign: 'center', color: T.inkFaint, fontSize: 13 }}>
                Select a day in the calendar above to view details.
              </Card>
            )}
          </div>
        </div>

        {/* Right: AI coach sidebar */}
        <div style={{ position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)' }}>
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
