'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  trainingPlanStreamUrl,
  type Sport,
  type TrainingPlanRequest,
} from '@/lib/api';
import { streamSse, type SseEvent } from '@/lib/sse';
import {
  T, Btn, Card, CardHeader, Field, PageHero, Banner, SectionLabel,
  TrackInput, TrackTextarea, TrackSelect, SPORT as SPORT_META,
  type SportKind,
} from '@/components/track';
import {
  WeekCalendar,
  type CalendarDay,
  type CalendarCellWorkout,
} from '@/components/training/WeekCalendar';
import { CoachPanel } from '@/components/training/CoachPanel';
import { applyToolEvent } from '@/components/training/ToolCallStack';
import type { ToolEventUi } from '@/components/training/ToolCallCard';

// ---------------------------------------------------------------------------

interface StreamedWorkoutRaw {
  templateId: string;
  sport: Sport;
  workoutType: string;
  title: string;
  intensity: 'low' | 'medium' | 'high';
  durationMinutes: number;
  distanceKm: number | null;
  targetMetric: string;
  targetHeartRate: string;
  targetPace: string;
  targetPower: string;
  workoutStructure: string;
  targets: string[];
  adaptation: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nextOrCurrentMonday(): string {
  const today = new Date();
  const dow = today.getDay();
  const offset = dow === 1 ? 0 : (8 - dow) % 7 || 7;
  const target = new Date(today);
  target.setDate(today.getDate() + offset);
  return toIsoDate(target);
}

type SportPriorityChoice = 'auto' | 'running' | 'cycling' | 'swimming';
type TargetMetricPref = 'auto' | 'heart_rate' | 'pace';

interface FormState {
  goal: string;
  raceDate: string;
  goalDistance: string;
  weekStartDate: string;
  daysPerWeek: number;
  preferredRestDay: string;
  sportRunning: boolean;
  sportCycling: boolean;
  sportSwimming: boolean;
  sportPriority: SportPriorityChoice;
  targetMetricPreference: TargetMetricPref;
  maxHardSessionsPerWeek: number | '';
  dailyPreferredMinutes: number | '';
  allowAdvancedWorkouts: boolean;
  allowDoubleDays: boolean;
  availableTime: string;
  preferredTrainingWindows: string;
  injuries: string;
  notes: string;
}

const initialForm = (): FormState => ({
  goal: '',
  raceDate: '',
  goalDistance: '',
  weekStartDate: nextOrCurrentMonday(),
  daysPerWeek: 4,
  preferredRestDay: '',
  sportRunning: true,
  sportCycling: false,
  sportSwimming: false,
  sportPriority: 'auto',
  targetMetricPreference: 'auto',
  maxHardSessionsPerWeek: 2,
  dailyPreferredMinutes: '',
  allowAdvancedWorkouts: false,
  allowDoubleDays: false,
  availableTime: '',
  preferredTrainingWindows: '',
  injuries: '',
  notes: '',
});

const REST_DAYS: { value: string; label: string }[] = [
  { value: '', label: '不指定' },
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' },
];

function buildPayload(f: FormState): TrainingPlanRequest | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.weekStartDate)) {
    return { error: '请选择周一日期' };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.weekStartDate)!;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getDay() !== 1) return { error: '周一日期必须是周一' };
  if (f.daysPerWeek < 1 || f.daysPerWeek > 7) return { error: '每周训练天数需为 1–7' };
  if (!f.sportRunning && !f.sportCycling && !f.sportSwimming) return { error: '至少选择一项训练项目' };

  const sportPriorities: Sport[] | undefined =
    f.sportPriority === 'auto' ? undefined : [f.sportPriority];

  return {
    goal: f.goal.trim() || undefined,
    raceDate: f.raceDate || null,
    goalDistance: f.goalDistance.trim() || null,
    weekStartDate: f.weekStartDate,
    daysPerWeek: f.daysPerWeek,
    preferredRestDay: f.preferredRestDay || undefined,
    availableTime: f.availableTime.trim() || undefined,
    preferredTrainingWindows: f.preferredTrainingWindows
      .split(/[，,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    dailyPreferredMinutes:
      f.dailyPreferredMinutes === '' ? null : Number(f.dailyPreferredMinutes),
    allowAdvancedWorkouts: f.allowAdvancedWorkouts,
    allowDoubleDays: f.allowDoubleDays,
    injuries: f.injuries.trim() || undefined,
    notes: f.notes.trim() || undefined,
    sports: {
      running: f.sportRunning,
      cycling: f.sportCycling,
      swimming: f.sportSwimming,
    },
    sportPriorities,
    maxHardSessionsPerWeek:
      f.maxHardSessionsPerWeek === '' ? null : Number(f.maxHardSessionsPerWeek),
    targetMetricPreference: f.targetMetricPreference,
  };
}

function mapStreamedWorkout(raw: Record<string, unknown>): StreamedWorkoutRaw {
  return {
    templateId: String(raw.templateId ?? ''),
    sport: raw.sport as Sport,
    workoutType: String(raw.workoutType ?? ''),
    title: String(raw.title ?? ''),
    intensity: (raw.intensity as 'low' | 'medium' | 'high') ?? 'low',
    durationMinutes: Number(raw.durationMinutes ?? 0),
    distanceKm:
      raw.distanceKm === null || raw.distanceKm === undefined
        ? null
        : Number(raw.distanceKm),
    targetMetric: String(raw.targetMetric ?? 'none'),
    targetHeartRate: String(raw.targetHeartRate ?? '不适用'),
    targetPace: String(raw.targetPace ?? '不适用'),
    targetPower: String(raw.targetPower ?? '不适用'),
    workoutStructure: String(raw.workoutStructure ?? ''),
    targets: Array.isArray(raw.targets) ? (raw.targets as string[]) : [],
    adaptation: String(raw.adaptation ?? ''),
  };
}

const SPORT_OPTIONS: { k: SportKind; label: string; field: keyof FormState }[] = [
  { k: 'running', label: '跑步', field: 'sportRunning' },
  { k: 'cycling', label: '骑行', field: 'sportCycling' },
  { k: 'swimming', label: '游泳', field: 'sportSwimming' },
];

type View = 'form' | 'staging' | 'finishing';

export default function NewTrainingPlanPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [view, setView] = useState<View>('form');
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [workouts, setWorkouts] = useState<Map<number, CalendarCellWorkout[]>>(new Map());
  const [summary, setSummary] = useState<string>('');
  const [toolEvents, setToolEvents] = useState<Map<string, ToolEventUi>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const orderCounterRef = useRef({ current: 0 });

  const planIdRef = useRef<string | null>(null);
  const fatalRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetGenerationState() {
    planIdRef.current = null;
    fatalRef.current = null;
    orderCounterRef.current = { current: 0 };
    setDays(null);
    setWorkouts(new Map());
    setToolEvents(new Map());
    setSummary('');
    setError(null);
  }

  function handleEvent(ev: SseEvent) {
    const data = (ev.data ?? null) as Record<string, unknown> | null;
    switch (ev.event) {
      case 'plan_created': {
        const id = data && typeof data.planId === 'string' ? data.planId : null;
        if (id) planIdRef.current = id;
        return;
      }
      case 'tool_event': {
        if (!data) return;
        const payload = data as {
          id: string;
          name: string;
          displayName: string;
          phase: 'start' | 'done' | 'error';
          summary?: string;
          errorMessage?: string;
          durationMs?: number;
        };
        setToolEvents((prev) => applyToolEvent(prev, payload, orderCounterRef.current));
        return;
      }
      case 'schedule': {
        const rawDays = data && Array.isArray(data.days) ? data.days : [];
        const next: CalendarDay[] = rawDays.map((d: unknown) => {
          const r = d as Record<string, unknown>;
          return {
            dayIndex: Number(r.dayIndex),
            date: String(r.date),
            dayLabel: String(r.dayLabel ?? ''),
            sport: r.sport as Sport,
          };
        });
        setDays(next);
        return;
      }
      case 'workout': {
        const w =
          data && typeof data.workout === 'object' && data.workout !== null
            ? (data.workout as Record<string, unknown>)
            : null;
        if (!w) return;
        const mapped = mapStreamedWorkout(w);
        const dayIndex =
          data && typeof data.dayIndex === 'number'
            ? (data.dayIndex as number)
            : 0;
        const slotIndex =
          data && typeof data.slotIndex === 'number'
            ? (data.slotIndex as number)
            : 1;
        if (!dayIndex) return;
        setWorkouts((prev) => {
          const m = new Map(prev);
          const list = m.get(dayIndex) ?? [];
          const cell: CalendarCellWorkout = {
            title: mapped.title,
            slotIndex,
            durationMinutes: mapped.durationMinutes,
            distanceKm: mapped.distanceKm,
            targetMetric: mapped.targetMetric as CalendarCellWorkout['targetMetric'],
            targetPace: mapped.targetPace,
            targetHeartRate: mapped.targetHeartRate,
            intensity: mapped.intensity,
            status: 'planned',
          };
          const next = list.filter((item) => (item.slotIndex ?? 1) !== slotIndex);
          next.push(cell);
          next.sort((a, b) => (a.slotIndex ?? 1) - (b.slotIndex ?? 1));
          m.set(dayIndex, next);
          return m;
        });
        return;
      }
      case 'summary_delta': {
        const delta = data && typeof data.delta === 'string' ? (data.delta as string) : '';
        if (delta) {
          setSummary((prev) => prev + delta);
        }
        return;
      }
      case 'error': {
        const msg = data && typeof data.error === 'string' ? (data.error as string) : '生成失败';
        fatalRef.current = msg;
        abortRef.current?.abort();
        return;
      }
      default:
        return;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (view !== 'form') return;
    resetGenerationState();

    const built = buildPayload(form);
    if ('error' in built) {
      setError(built.error);
      return;
    }

    setView('staging');
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamSse({
        url: trainingPlanStreamUrl,
        body: built,
        signal: ctrl.signal,
        onEvent: handleEvent,
      });
    } catch (e) {
      const errObj = e as Error & { status?: number };
      if (errObj.status === 402) {
        fatalRef.current = '当前未开通 Pro 或本月计划生成额度已用完。';
      } else if (!ctrl.signal.aborted) {
        fatalRef.current = errObj.message || '生成失败';
      }
    }

    if (fatalRef.current) {
      setError(fatalRef.current);
      setView('form');
      return;
    }
    if (planIdRef.current) {
      setView('finishing');
      setTimeout(() => {
        router.push(`/training/${planIdRef.current}`);
      }, 900);
    } else {
      setError('生成已完成，但未获取到计划 ID。请回到列表页查看。');
      setView('form');
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setView('form');
  }

  const selectedSports = SPORT_OPTIONS.filter((s) => form[s.field] === true);
  const eventsArray = useMemo(() => Array.from(toolEvents.values()), [toolEvents]);

  // ---- Staging / Finishing view ----
  if (view !== 'form') {
    const allDone = workouts.size >= (days?.length ?? 0) && (days?.length ?? 0) > 0;
    const statusLabel = view === 'finishing'
      ? '准备就绪，跳转中…'
      : allDone
        ? '所有日程已就绪'
        : '正在生成…';
    const statusTone = view === 'finishing' || allDone ? 'green' as const : 'cyan' as const;
    return (
      <>
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1.2 }}>
            // 生成中… 取消即返回填写表单
          </span>
        </div>

        <PageHero
          eyebrow="// AI 正在工作"
          title="生成本周计划"
          sub="AI 教练正在读取你的 Garmin 数据、编排日程并配置每一节课。整个过程透明可见 ↓"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
          <Card style={{ padding: 22 }}>
            <CardHeader
              eyebrow="// 本周日程"
              title="周一 → 周日"
              right={
                <span
                  className={view === 'staging' && !allDone ? 'track-blink' : ''}
                  style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan, letterSpacing: 1.2 }}
                >
                  ● {workouts.size}/{days?.length ?? 7} 已生成
                </span>
              }
            />
            <div style={{ marginTop: 16 }}>
              <WeekCalendar
                days={days}
                workouts={workouts}
                mode="generation"
              />
            </div>
          </Card>

          <CoachPanel
            events={eventsArray}
            summaryText={summary}
            status={{ label: statusLabel, anim: view === 'staging' && !allDone, tone: statusTone }}
            eyebrow="// AI 实时过程"
            title="AI 教练"
            footer={
              view === 'staging' ? (
                <Btn variant="ghost" size="sm" onClick={handleCancel}>取消并返回</Btn>
              ) : null
            }
          />
        </div>
      </>
    );
  }

  // ---- Form view ----
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <Link href="/training" className="track-link" style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2 }}>
          ← 返回列表
        </Link>
      </div>

      <PageHero
        eyebrow="// 新建计划"
        title="新建训练计划"
        sub="AI 会读取你 Garmin 上最近的活动数据，结合目标生成第 1 周计划。后续每周根据完成情况自动调整。"
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 18 }}>
        <Card style={{ padding: 26 }}>
          <CardHeader eyebrow="// 基础设置" title="基础设置" />
          <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="运动项目" full>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SPORT_OPTIONS.map((s) => {
                  const active = form[s.field] as boolean;
                  const c = SPORT_META[s.k].color;
                  return (
                    <button key={s.k} type="button"
                      onClick={() => setField(s.field, !active as FormState[typeof s.field])}
                      style={{
                        flex: '1 1 0', minWidth: 110, padding: 14, borderRadius: 8, cursor: 'pointer',
                        background: active ? `${c}20` : 'transparent',
                        border: `1px solid ${active ? c : T.border}`,
                        color: active ? c : T.inkDim,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <span style={{ fontSize: 15, color: active ? c : T.ink, letterSpacing: -0.2, fontFamily: T.sans, fontWeight: 600 }}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="目标">
              <TrackInput
                value={form.goal}
                onChange={(e) => setField('goal', e.target.value)}
                maxLength={500}
                placeholder="半马 PB / 完成首场全马 / 提升耐力"
              />
            </Field>

            <Field label="目标距离">
              <TrackInput
                mono
                value={form.goalDistance}
                onChange={(e) => setField('goalDistance', e.target.value)}
                maxLength={50}
                placeholder="21.1km / 10km / 100km bike"
              />
            </Field>

            <Field label="周一日期">
              <TrackInput
                type="date"
                value={form.weekStartDate}
                onChange={(e) => setField('weekStartDate', e.target.value)}
                required
              />
            </Field>

            <Field label="比赛日期(可选)">
              <TrackInput
                type="date"
                value={form.raceDate}
                onChange={(e) => setField('raceDate', e.target.value)}
              />
            </Field>

            <Field label={`每周训练天数 · ${form.daysPerWeek} 天`} full>
              <div style={{ display: 'flex', gap: 6 }}>
                {[3, 4, 5, 6, 7].map((d) => (
                  <button key={d} type="button" onClick={() => setField('daysPerWeek', d)} style={{
                    flex: 1, padding: '10px 0', borderRadius: 6, cursor: 'pointer',
                    background: d === form.daysPerWeek ? T.lime : 'transparent',
                    color: d === form.daysPerWeek ? T.bg : T.inkDim,
                    border: `1px solid ${d === form.daysPerWeek ? T.lime : T.border}`,
                    fontFamily: T.mono, fontSize: 13, fontWeight: 600,
                  }}>{d}</button>
                ))}
              </div>
            </Field>

            <Field label="偏好休息日">
              <TrackSelect
                value={form.preferredRestDay}
                onChange={(e) => setField('preferredRestDay', e.target.value)}
              >
                {REST_DAYS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </TrackSelect>
            </Field>

            <Field label="主项目">
              <TrackSelect
                value={form.sportPriority}
                onChange={(e) => setField('sportPriority', e.target.value as SportPriorityChoice)}
              >
                <option value="auto">自动</option>
                <option value="running">跑步优先</option>
                <option value="cycling">骑行优先</option>
                <option value="swimming">游泳优先</option>
              </TrackSelect>
            </Field>

            <Field label="主指标偏好" full>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { v: 'auto', label: '自动' },
                  { v: 'heart_rate', label: '心率优先' },
                  { v: 'pace', label: '配速优先' },
                ] as const).map((opt) => {
                  const active = form.targetMetricPreference === opt.v;
                  return (
                    <button key={opt.v} type="button"
                      onClick={() => setField('targetMetricPreference', opt.v)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 6, cursor: 'pointer',
                        background: active ? T.limeGlow : 'transparent',
                        color: active ? T.lime : T.inkDim,
                        border: `1px solid ${active ? T.lime : T.border}`,
                        fontFamily: T.sans, fontSize: 13, fontWeight: 500,
                      }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="每周高强度上限">
              <TrackInput
                type="number"
                min={0}
                max={7}
                value={form.maxHardSessionsPerWeek}
                onChange={(e) => {
                  const v = e.target.value;
                  setField(
                    'maxHardSessionsPerWeek',
                    v === '' ? '' : Math.max(0, Math.min(7, Number(v))),
                  );
                }}
                placeholder="留空 = 自动"
              />
            </Field>

            <Field label="每日偏好时长">
              <TrackInput
                type="number"
                min={15}
                max={600}
                value={form.dailyPreferredMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  setField('dailyPreferredMinutes', v === '' ? '' : Math.max(15, Math.min(600, Number(v))));
                }}
                placeholder="例：75"
              />
            </Field>

            <Field label="可用时间(可选)">
              <TrackInput
                value={form.availableTime}
                onChange={(e) => setField('availableTime', e.target.value)}
                maxLength={200}
                placeholder="工作日 60 分钟 / 周末 90+ 分钟"
              />
            </Field>

            <Field label="偏好时段">
              <TrackInput
                value={form.preferredTrainingWindows}
                onChange={(e) => setField('preferredTrainingWindows', e.target.value)}
                maxLength={200}
                placeholder="上午, 晚上"
              />
            </Field>

            <Field label="高级训练" full>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.inkDim, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.allowAdvancedWorkouts}
                  onChange={(e) => {
                    setField('allowAdvancedWorkouts', e.target.checked);
                    if (!e.target.checked) setField('allowDoubleDays', false);
                  }}
                />
                允许 VO2max、短间歇、无氧、冲刺、坡跑/爬坡、比赛专项等高级课
              </label>
            </Field>

            <Field label="多时段/一天多练" full>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.inkDim, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.allowDoubleDays}
                  disabled={!form.allowAdvancedWorkouts}
                  onChange={(e) => setField('allowDoubleDays', e.target.checked)}
                />
                允许同一天安排两练，包括双阈值；仅在高级训练开启后生效
              </label>
            </Field>

            <Field label="伤病禁忌" full>
              <TrackTextarea
                value={form.injuries}
                onChange={(e) => setField('injuries', e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="例：左膝软骨敏感，避免大量下坡"
              />
            </Field>

            <Field label="备注" full>
              <TrackTextarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="任何想让 AI 教练知道的事…"
              />
            </Field>

            <div style={{ gridColumn: '1 / -1', marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
              <Link href="/training" style={{ textDecoration: 'none' }}>
                <Btn variant="ghost" type="button">返回</Btn>
              </Link>
              <Btn type="submit">生成计划 →</Btn>
            </div>
          </form>
        </Card>

        <Card style={{ padding: 22, alignSelf: 'start' }}>
          <CardHeader eyebrow="// AI 预览" title="AI 将基于以下输入" />
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Row k="周一日期" v={form.weekStartDate} c={T.lime} />
            <Row k="每周天数" v={`${form.daysPerWeek} 天`} />
            <Row k="运动项目" v={selectedSports.length ? selectedSports.map((s) => SPORT_META[s.k].label).join(' · ') : '—'} c={T.cyan} />
            <Row k="主项目" v={form.sportPriority === 'auto' ? '自动' : SPORT_META[form.sportPriority as SportKind].label} />
            <Row k="主指标" v={form.targetMetricPreference === 'auto' ? '自动' : form.targetMetricPreference === 'heart_rate' ? '心率优先' : '配速优先'} />
            <Row k="高强度" v={form.maxHardSessionsPerWeek === '' ? '自动' : `${form.maxHardSessionsPerWeek} 次/周`} />
            <Row k="高级课" v={form.allowAdvancedWorkouts ? '允许' : '关闭'} />
            <Row k="多练" v={form.allowDoubleDays ? '允许' : '关闭'} />
          </div>
          <div style={{
            marginTop: 16, padding: 12, fontFamily: T.mono, fontSize: 11,
            color: T.inkDim, lineHeight: 1.7, background: 'rgba(0,0,0,0.25)',
            border: `1px solid ${T.border}`, borderRadius: 6,
          }}>
            <span style={{ color: T.cyan }}>● </span>
            点击生成后会进入 AI 教练界面，逐条展示数据加载、日程编排、参数化与校验等步骤。
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '6px 0', borderBottom: `1px dashed ${T.border}` }}>
      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, width: 100 }}>{k}</span>
      <span style={{ flex: 1, fontFamily: T.mono, fontSize: 13, color: c ?? T.ink }}>{v}</span>
    </div>
  );
}
