'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SPORT_LABELS,
  trainingPlanStreamUrl,
  type Sport,
  type TrainingPlanRequest,
} from '@/lib/api';
import { streamSse, type SseEvent } from '@/lib/sse';

// ---------------------------------------------------------------------------
// Local types — match the SSE payload shapes emitted by api/src/routes/training.ts
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

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextOrCurrentMonday(): string {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // If today is Mon, use today. Otherwise next Monday.
  const offset = dow === 1 ? 0 : (8 - dow) % 7 || 7;
  const target = new Date(today);
  target.setDate(today.getDate() + offset);
  return toIsoDate(target);
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type SportPriorityChoice = 'auto' | 'running' | 'cycling' | 'swimming';
type TargetMetricPref = 'auto' | 'heart_rate' | 'pace';

interface FormState {
  goal: string;
  raceDate: string;
  goalDistance: string;
  weekStartDate: string;
  daysPerWeek: number;
  preferredRestDay: string; // '' | 'monday'..'sunday'
  sportRunning: boolean;
  sportCycling: boolean;
  sportSwimming: boolean;
  sportPriority: SportPriorityChoice;
  targetMetricPreference: TargetMetricPref;
  maxHardSessionsPerWeek: number | ''; // '' = auto/null
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
  // Validate week start is a Monday (local).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.weekStartDate)!;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getDay() !== 1) {
    return { error: '周一日期必须是周一' };
  }
  if (f.daysPerWeek < 1 || f.daysPerWeek > 7) {
    return { error: '每周训练天数需为 1–7' };
  }
  if (!f.sportRunning && !f.sportCycling && !f.sportSwimming) {
    return { error: '至少选择一项训练项目' };
  }

  const sportPriorities: Sport[] | undefined =
    f.sportPriority === 'auto' ? undefined : [f.sportPriority];

  const payload: TrainingPlanRequest = {
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
  return payload;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewTrainingPlanPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [workouts, setWorkouts] = useState<Map<number, StreamedWorkout>>(
    new Map(),
  );
  const [summary, setSummary] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  // Tracks which dayIndex slot the next workout-without-dayIndex event fills.
  // The /plans endpoint emits workouts in schedule order without a dayIndex,
  // so we fill 1..7 in arrival order. Reset on each new submission.
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
        const delta =
          data && typeof data.delta === 'string' ? (data.delta as string) : '';
        if (delta) {
          setSummary((prev) => prev + delta);
          setProgressMsg('正在生成总结与监测建议…');
        }
        return;
      }
      case 'error': {
        const msg =
          data && typeof data.error === 'string'
            ? (data.error as string)
            : '生成失败';
        fatalRef.current = msg;
        // Abort the stream so subsequent events can't keep mutating React
        // state we're about to discard. The catch block in handleSubmit
        // sees AbortError and falls through to the fatalRef branch.
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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">新建训练计划</h1>
        <p className="text-zinc-500 mt-1">
          基于近期 Garmin 数据 + 你的目标，生成一周训练。
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="目标">
            <input
              value={form.goal}
              onChange={(e) => setField('goal', e.target.value)}
              maxLength={500}
              placeholder="例如：半马 PB / 完成首场全马 / 提升耐力"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>
          <Field label="比赛日期（可选）">
            <input
              type="date"
              value={form.raceDate}
              onChange={(e) => setField('raceDate', e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>

          <Field label="目标距离（可选）">
            <input
              value={form.goalDistance}
              onChange={(e) => setField('goalDistance', e.target.value)}
              maxLength={50}
              placeholder="21.1km / 10km / 100km bike"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>

          <Field label="周一日期（必填）">
            <input
              type="date"
              value={form.weekStartDate}
              onChange={(e) => setField('weekStartDate', e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>

          <Field label="每周训练天数">
            <input
              type="number"
              min={1}
              max={7}
              value={form.daysPerWeek}
              onChange={(e) =>
                setField('daysPerWeek', Number(e.target.value) || 1)
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              required
            />
          </Field>

          <Field label="偏好休息日">
            <select
              value={form.preferredRestDay}
              onChange={(e) => setField('preferredRestDay', e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 bg-white"
            >
              {REST_DAYS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="训练项目（至少一项）">
            <div className="flex flex-wrap gap-3 pt-2">
              <CheckLabel
                checked={form.sportRunning}
                onChange={(v) => setField('sportRunning', v)}
              >
                🏃 跑步
              </CheckLabel>
              <CheckLabel
                checked={form.sportCycling}
                onChange={(v) => setField('sportCycling', v)}
              >
                🚴 骑行
              </CheckLabel>
              <CheckLabel
                checked={form.sportSwimming}
                onChange={(v) => setField('sportSwimming', v)}
              >
                🏊 游泳
              </CheckLabel>
            </div>
          </Field>

          <Field label="主项目优先级">
            <select
              value={form.sportPriority}
              onChange={(e) =>
                setField('sportPriority', e.target.value as SportPriorityChoice)
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 bg-white"
            >
              <option value="auto">自动</option>
              <option value="running">跑步优先</option>
              <option value="cycling">骑行优先</option>
              <option value="swimming">游泳优先</option>
            </select>
          </Field>

          <Field label="主指标偏好">
            <div className="flex flex-wrap gap-4 pt-2">
              {(
                [
                  { v: 'auto', label: '自动' },
                  { v: 'heart_rate', label: '心率优先' },
                  { v: 'pace', label: '配速优先' },
                ] as const
              ).map((opt) => (
                <label key={opt.v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="targetMetricPreference"
                    value={opt.v}
                    checked={form.targetMetricPreference === opt.v}
                    onChange={() => setField('targetMetricPreference', opt.v)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="每周最大高强度课（留空 = 自动）">
            <input
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
              placeholder="例如 2"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>

          <Field label="可用时间（可选）">
            <input
              value={form.availableTime}
              onChange={(e) => setField('availableTime', e.target.value)}
              maxLength={200}
              placeholder="工作日 60 分钟，周末 90+"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>

          <Field label="伤病/禁忌（可选）" full>
            <textarea
              value={form.injuries}
              onChange={(e) => setField('injuries', e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="例如：左膝软骨敏感，避免大量下坡"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>

          <Field label="备注（可选）" full>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="任何其他想让 AI 教练知道的事…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>

          <div className="sm:col-span-2 flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700"
            >
              {submitting ? '生成中…' : '生成计划'}
            </button>
            {submitting && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                取消
              </button>
            )}
            {progressMsg && !error && (
              <span className="text-sm text-zinc-500">{progressMsg}</span>
            )}
          </div>
        </form>
      </section>

      {(days || workouts.size > 0 || summary) && (
        <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">生成进度</h2>
          {summary && (
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
              {summary}
            </p>
          )}
          {days && (
            <div className="grid gap-2 sm:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => {
                const idx = i + 1;
                const day = days.find((d) => d.dayIndex === idx);
                const w = workouts.get(idx);
                return (
                  <div
                    key={idx}
                    className="border border-zinc-200 rounded-lg p-2 text-xs min-h-[88px]"
                  >
                    <div className="font-medium text-zinc-700">
                      {day?.dayLabel ?? `第 ${idx} 天`}
                    </div>
                    <div className="text-zinc-500 mt-1">
                      {day ? SPORT_LABELS[day.sport] : '…'}
                    </div>
                    {w ? (
                      <div className="mt-1 text-zinc-800 leading-snug">
                        {w.title}
                      </div>
                    ) : (
                      <div className="mt-1 text-zinc-400">…</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {dayCount > 0 && workouts.size === 7 && (
            <p className="text-xs text-emerald-600">
              已完成所有日程（{workouts.size}/7），即将跳转…
            </p>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline subcomponents (matches admin/page.tsx style)
// ---------------------------------------------------------------------------

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CheckLabel({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
