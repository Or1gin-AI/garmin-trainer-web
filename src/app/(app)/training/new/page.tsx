'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SPORT_LABELS,
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

// ---------------------------------------------------------------------------

interface ScheduleDay {
  dayIndex: number;
  date: string;
  dayLabel: string;
  sport: Sport;
  templateId: string;
  reason?: string;
}

interface StreamedWorkout {
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
  availableTime: string;
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
  availableTime: '',
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

function mapStreamedWorkout(raw: Record<string, unknown>): StreamedWorkout {
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

export default function NewTrainingPlanPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [workouts, setWorkouts] = useState<Map<number, StreamedWorkout>>(new Map());
  const [summary, setSummary] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const slotRef = useRef<number>(1);
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

  function reset() {
    slotRef.current = 1;
    planIdRef.current = null;
    fatalRef.current = null;
    setDays(null);
    setWorkouts(new Map());
    setSummary('');
    setProgressMsg('');
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
      case 'schedule': {
        const rawDays = data && Array.isArray(data.days) ? data.days : [];
        const next: ScheduleDay[] = rawDays.map((d: unknown) => {
          const r = d as Record<string, unknown>;
          return {
            dayIndex: Number(r.dayIndex),
            date: String(r.date),
            dayLabel: String(r.dayLabel ?? ''),
            sport: r.sport as Sport,
            templateId: String(r.templateId ?? ''),
            reason: typeof r.reason === 'string' ? r.reason : undefined,
          };
        });
        setDays(next);
        setProgressMsg('已生成日程，正在补充每日训练…');
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
            : (() => {
                const v = slotRef.current;
                slotRef.current = Math.min(7, slotRef.current + 1);
                return v;
              })();
        setWorkouts((prev) => {
          const m = new Map(prev);
          m.set(dayIndex, mapped);
          return m;
        });
        return;
      }
      case 'summary_delta': {
        const delta = data && typeof data.delta === 'string' ? (data.delta as string) : '';
        if (delta) {
          setSummary((prev) => prev + delta);
          setProgressMsg('正在生成总结与监测建议…');
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
    if (submitting) return;
    reset();

    const built = buildPayload(form);
    if ('error' in built) {
      setError(built.error);
      return;
    }

    setSubmitting(true);
    setProgressMsg('正在生成计划…');
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
      fatalRef.current = (e as Error).message || '生成失败';
    } finally {
      setSubmitting(false);
    }

    if (fatalRef.current) {
      setError(fatalRef.current);
      setProgressMsg('');
      return;
    }
    if (planIdRef.current) {
      router.push(`/training/${planIdRef.current}`);
    } else {
      setProgressMsg('生成已完成，但未获取到计划 ID。请回到列表页查看。');
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setSubmitting(false);
    setProgressMsg('已取消');
  }

  const dayCount = useMemo(() => (days ? days.length : 0), [days]);
  const selectedSports = SPORT_OPTIONS.filter((s) => form[s.field] === true);

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

            <Field label="可用时间(可选)">
              <TrackInput
                value={form.availableTime}
                onChange={(e) => setField('availableTime', e.target.value)}
                maxLength={200}
                placeholder="工作日 60 分钟 / 周末 90+ 分钟"
              />
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
              {progressMsg && !error && (
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.cyan, letterSpacing: 1, marginRight: 'auto' }} className={submitting ? 'track-blink' : ''}>
                  ● {progressMsg}
                </span>
              )}
              {submitting && (
                <Btn variant="ghost" type="button" onClick={handleCancel}>取消</Btn>
              )}
              <Link href="/training" style={{ textDecoration: 'none' }}>
                <Btn variant="ghost" type="button">返回</Btn>
              </Link>
              <Btn type="submit" disabled={submitting}>
                {submitting ? '生成中…' : '生成计划 →'}
              </Btn>
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
          </div>
          <div style={{
            marginTop: 16, padding: 12, fontFamily: T.mono, fontSize: 11,
            color: T.inkDim, lineHeight: 1.7, background: 'rgba(0,0,0,0.25)',
            border: `1px solid ${T.border}`, borderRadius: 6,
          }}>
            <span style={{ color: T.cyan }}>● </span>
            AI 会读取你 Garmin 最近 60 天的活动，估算 LT/VO2max 并据此设置心率与配速区间。
          </div>
        </Card>
      </div>

      {(days || workouts.size > 0 || summary) && (
        <div style={{ marginTop: 28 }}>
          <SectionLabel>生成进度</SectionLabel>
          <Card style={{ padding: 22 }}>
            {summary && (
              <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.7, whiteSpace: 'pre-line', margin: '0 0 14px' }}>
                {summary}
              </p>
            )}
            {days && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const idx = i + 1;
                  const day = days.find((d) => d.dayIndex === idx);
                  const w = workouts.get(idx);
                  const sport = day ? SPORT_META[day.sport as SportKind] : null;
                  return (
                    <div key={idx} style={{
                      border: `1px solid ${T.border}`, borderRadius: 8, padding: 10,
                      minHeight: 90, background: 'rgba(255,255,255,0.02)',
                    }}>
                      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1 }}>
                        第 {idx} 天
                      </div>
                      <div style={{ fontFamily: T.mono, fontSize: 11, color: sport?.color ?? T.inkFaint, letterSpacing: 0.5, marginTop: 4 }}>
                        {day ? (sport?.label ?? SPORT_LABELS[day.sport]) : '…'}
                      </div>
                      {w ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: T.ink, lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {w.title}
                        </div>
                      ) : (
                        <div className="track-blink" style={{ marginTop: 6, fontFamily: T.mono, fontSize: 10, color: T.inkFaint }}>…</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {dayCount > 0 && workouts.size === 7 && (
              <p style={{ marginTop: 12, fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1 }}>
                ● 所有日程已就绪（{workouts.size}/7），即将跳转…
              </p>
            )}
          </Card>
        </div>
      )}
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
