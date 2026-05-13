'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteTrainingPlanFromGarmin,
  getTrainingPlanGarminStatus,
  getTrainingPlan,
  patchTrainingWorkout,
  pushTrainingPlanToGarmin,
  trainingDayRegenerateUrl,
  trainingPlanExportUrl,
  type GarminPlanPublishStatus,
  type GarminRegion,
  type PlanStatus,
  type Sport,
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
import {
  WeekCalendar,
  toCalendarCell,
  type CalendarDay,
  type CalendarCellWorkout,
} from '@/components/training/WeekCalendar';

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const EXPORT_FORMATS = [
  { key: 'intervals_icu', label: 'Intervals.icu' },
  { key: 'word', label: 'Word' },
  { key: 'pdf', label: 'PDF' },
  { key: 'excel', label: 'Excel' },
] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number]['key'];

const GARMIN_REGIONS: Array<{ key: GarminRegion; label: string; code: string; host: string }> = [
  { key: 'cn', label: '国区', code: 'CN', host: 'garmin.cn' },
  { key: 'global', label: '国际区', code: 'INTL', host: 'garmin.com' },
];

function garminRegionLabel(region: GarminRegion): string {
  return GARMIN_REGIONS.find((r) => r.key === region)?.label ?? region;
}

function formatWeekStart(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]} · ${Number(m[2])}月${Number(m[3])}日 ${WEEKDAYS[date.getDay()]}`;
}

function planShortId(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

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
  const params = useParams<{ planId: string }>();
  const planId = params?.planId ?? '';

  const [detail, setDetail] = useState<TrainingPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyWorkoutId, setBusyWorkoutId] = useState<string | null>(null);
  const [pendingExport, setPendingExport] = useState<ExportFormat | null>(null);
  const [garminRegion, setGarminRegion] = useState<GarminRegion>('cn');
  const [garminStatus, setGarminStatus] = useState<GarminPlanPublishStatus | null>(null);
  const [garminBusy, setGarminBusy] = useState<'push' | 'delete' | null>(null);
  const [garminNotice, setGarminNotice] = useState<string | null>(null);
  const [confirmGarminDelete, setConfirmGarminDelete] = useState(false);
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!planId) return;
    try {
      const [d, status] = await Promise.all([
        getTrainingPlan(planId),
        getTrainingPlanGarminStatus(planId, garminRegion).catch(() => null),
      ]);
      setDetail(d);
      setGarminStatus(status);
      setNotFound(false);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 404) setNotFound(true);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [planId, garminRegion]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    setGarminStatus(null);
    setGarminNotice(null);
    setConfirmGarminDelete(false);
  }, [garminRegion]);

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      regenAbortRef.current?.abort();
    },
    [],
  );

  // Auto-pick the day to display when data first lands.
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

  async function pushGarminPlan() {
    if (!planId || garminBusy) return;
    const regionLabel = garminRegionLabel(garminRegion);
    setGarminBusy('push');
    setGarminNotice(null);
    setError(null);
    try {
      const result = await pushTrainingPlanToGarmin(planId, garminRegion);
      setGarminStatus(result.status);
      setGarminNotice(
        result.blockedByCleanup
          ? `${regionLabel}旧副本有 ${result.failed} 节删除失败，已停止上传，避免重复堆积。`
          : result.failed > 0
          ? `已上传 ${result.pushed} 节到${regionLabel}，${result.failed} 节失败，可重试。`
          : result.deletedBeforePush > 0
            ? `已清理${regionLabel}旧副本 ${result.deletedBeforePush} 节，并重新上传 ${result.pushed} 节。`
            : `已上传 ${result.pushed} 节到${regionLabel} Garmin。`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGarminBusy(null);
    }
  }

  async function deleteGarminPlan() {
    if (!planId || garminBusy) return;
    const regionLabel = garminRegionLabel(garminRegion);
    setGarminBusy('delete');
    setGarminNotice(null);
    setError(null);
    try {
      const result = await deleteTrainingPlanFromGarmin(planId, garminRegion);
      setGarminStatus(result.status);
      setConfirmGarminDelete(false);
      setGarminNotice(
        result.failed > 0
          ? `已从${regionLabel}删除 ${result.deleted} 节，${result.failed} 节失败，可重试。`
          : `已从${regionLabel} Garmin 删除 ${result.deleted} 节。`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGarminBusy(null);
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

  function confirmExport() {
    if (!pendingExport || !detail) return;
    window.location.href = trainingPlanExportUrl(detail.plan.id, pendingExport);
    setPendingExport(null);
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
  const ordered = [...workouts].sort((a, b) => a.dayIndex - b.dayIndex || (a.slotIndex ?? 1) - (b.slotIndex ?? 1));
  const completed = ordered.filter((w) => w.status === 'completed').length;
  const totalKm = ordered.reduce((s, w) => s + (Number(w.distanceKm) || 0), 0);
  const totalMin = ordered.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);

  const selected = selectedDay != null ? ordered.filter((w) => w.dayIndex === selectedDay) : [];

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
            <Link href="/calendar" style={{ textDecoration: 'none' }}>
              <Btn variant="ok" size="sm">去日历应用</Btn>
            </Link>
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
      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5, marginBottom: 4 }}>EXPORT</div>
            <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>导出文档选项</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EXPORT_FORMATS.map((f) => (
              <Btn key={f.key} variant="ghost" size="sm" onClick={() => setPendingExport(f.key)}>
                {f.label}
              </Btn>
            ))}
          </div>
        </div>
      </Card>

      {pendingExport && (
        <ConfirmExportDialog
          format={pendingExport}
          onCancel={() => setPendingExport(null)}
          onConfirm={confirmExport}
        />
      )}

      {confirmGarminDelete && (
        <ConfirmGarminDeleteDialog
          region={garminRegion}
          status={garminStatus}
          busy={garminBusy === 'delete'}
          onCancel={() => setConfirmGarminDelete(false)}
          onConfirm={deleteGarminPlan}
        />
      )}

      <GarminPublishPanel
        region={garminRegion}
        status={garminStatus}
        notice={garminNotice}
        busy={garminBusy}
        planReady={plan.status === 'ready'}
        onRegionChange={setGarminRegion}
        onPush={pushGarminPlan}
        onDelete={() => setConfirmGarminDelete(true)}
      />

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

      <SectionLabel>本周日历</SectionLabel>
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

      <SectionLabel>当日详情</SectionLabel>
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
            点击上方日历选择一天查看详情。
          </Card>
        )}
      </div>

      <SectionLabel>AI 教练</SectionLabel>
      <div style={{ maxWidth: 880 }}>
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

function ConfirmExportDialog({
  format,
  onCancel,
  onConfirm,
}: {
  format: ExportFormat;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = EXPORT_FORMATS.find((f) => f.key === format)?.label ?? format;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: 'min(460px, 100%)', padding: 22, boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5, marginBottom: 6 }}>
          EXPORT.CONFIRM
        </div>
        <h2 style={{ margin: '0 0 10px', color: T.ink, fontSize: 20, fontWeight: 700 }}>
          确认导出 {label}
        </h2>
        <p style={{ margin: '0 0 18px', color: T.inkDim, fontSize: 13, lineHeight: 1.7 }}>
          导出文档选项在这里。确认后浏览器会下载该格式文件；取消则不会产生下载。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" size="sm" onClick={onCancel}>取消</Btn>
          <Btn size="sm" onClick={onConfirm}>确认下载</Btn>
        </div>
      </Card>
    </div>
  );
}

function GarminPublishPanel({
  region,
  status,
  notice,
  busy,
  planReady,
  onRegionChange,
  onPush,
  onDelete,
}: {
  region: GarminRegion;
  status: GarminPlanPublishStatus | null;
  notice: string | null;
  busy: 'push' | 'delete' | null;
  planReady: boolean;
  onRegionChange: (region: GarminRegion) => void;
  onPush: () => void;
  onDelete: () => void;
}) {
  const uploaded = status?.uploaded ?? false;
  const scheduled = status?.scheduled ?? 0;
  const failed = status?.failed ?? 0;
  const activeCount = status?.activeCount ?? 0;
  const deleted = status?.deleted ?? 0;
  const lastUpdated = status?.lastUpdatedAt
    ? new Date(status.lastUpdatedAt).toLocaleString('zh-CN')
    : null;
  const regionMeta = GARMIN_REGIONS.find((item) => item.key === region) ?? GARMIN_REGIONS[0];

  const statusText = status
    ? uploaded
      ? failed > 0
        ? `${regionMeta.label}已上传 ${scheduled} 节，${failed} 节需要处理`
        : `${regionMeta.label}已上传 ${scheduled} 节`
      : deleted > 0
        ? `${regionMeta.label}远端副本已删除`
        : `${regionMeta.label}尚未上传`
    : '读取 Garmin 状态中';

  return (
    <Card style={{ padding: 16, marginBottom: 20, borderColor: uploaded ? `${T.cyan}55` : T.border }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: uploaded ? T.cyan : T.lime, letterSpacing: 1.5, marginBottom: 4 }}>
            GARMIN.PUBLISH · {regionMeta.code}
          </div>
          <div style={{ fontSize: 14, color: T.ink, fontWeight: 700, marginBottom: 6 }}>
            {statusText}
          </div>
          <div style={{ fontSize: 12, color: T.inkDim, lineHeight: 1.6 }}>
            {uploaded
              ? `这份计划在 ${regionMeta.host} 有 ${activeCount} 条可追踪远端记录。`
              : `上传后会在 ${regionMeta.host} 日历生成未来 30 天训练安排，并同步到兼容设备。`}
            {lastUpdated ? ` 最近更新：${lastUpdated}` : ''}
          </div>
          {notice && (
            <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: 11, color: failed > 0 ? T.amber : T.green }}>
              {notice}
            </div>
          )}
          {failed > 0 && status?.workouts.some((w) => w.status === 'failed' && w.lastError) && (
            <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: 10, color: T.red, lineHeight: 1.5 }}>
              {status.workouts
                .filter((w) => w.status === 'failed' && w.lastError)
                .slice(0, 2)
                .map((w) => `${w.workoutName}: ${w.lastError}`)
                .join('\n')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'flex-end' }}>
            {GARMIN_REGIONS.map((item) => (
              <Btn
                key={item.key}
                variant={region === item.key ? 'ok' : 'ghost'}
                size="sm"
                onClick={() => onRegionChange(item.key)}
                disabled={busy !== null}
              >
                {item.label}
              </Btn>
            ))}
          </div>
          <Btn
            size="sm"
            onClick={onPush}
            disabled={!planReady || busy !== null}
          >
            {busy === 'push' ? '上传中…' : uploaded ? '重新上传' : `上传到${regionMeta.label}`}
          </Btn>
          {uploaded && (
            <Btn
              variant="danger"
              size="sm"
              onClick={onDelete}
              disabled={busy !== null}
            >
              {busy === 'delete' ? '删除中…' : `从${regionMeta.label}删除`}
            </Btn>
          )}
        </div>
      </div>
    </Card>
  );
}

function ConfirmGarminDeleteDialog({
  region,
  status,
  busy,
  onCancel,
  onConfirm,
}: {
  region: GarminRegion;
  status: GarminPlanPublishStatus | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const count = status?.activeCount ?? 0;
  const regionLabel = garminRegionLabel(region);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: 'min(500px, 100%)', padding: 22, boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.red, letterSpacing: 1.5, marginBottom: 6 }}>
          GARMIN.DELETE
        </div>
        <h2 style={{ margin: '0 0 10px', color: T.ink, fontSize: 20, fontWeight: 700 }}>
          从{regionLabel} Garmin 删除这份计划？
        </h2>
        <p style={{ margin: '0 0 18px', color: T.inkDim, fontSize: 13, lineHeight: 1.7 }}>
          将删除{regionLabel} Garmin 日历中由 Garmin Trainer 创建的 {count} 条训练安排，并删除对应 workout 模板。本地训练计划不会删除。
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>取消</Btn>
          <Btn variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? '删除中…' : '确认删除'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
