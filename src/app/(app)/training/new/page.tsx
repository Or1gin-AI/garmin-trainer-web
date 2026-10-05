'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  trainingPlanStreamUrl,
  type Sport,
  type TrainingCapacityView,
  type TrainingPlanRequest,
} from '@/lib/api';
import { streamSse, type SseEvent } from '@/lib/sse';
import {
  T, Btn, Card, CardHeader, Field, PageHero, Banner,
  TrackInput, TrackTextarea, TrackSelect, SPORT as SPORT_META,
  type SportKind,
} from '@/components/track';
import {
  WeekCalendar,
  type CalendarDay,
  type CalendarCellWorkout,
} from '@/components/training/WeekCalendar';
import { CoachPanel } from '@/components/training/CoachPanel';
import { TrainingEvidencePanel } from '@/components/training/TrainingEvidencePanel';
import { applyToolEvent } from '@/components/training/ToolCallStack';
import type { ToolEventUi } from '@/components/training/ToolCallCard';
import {
  readScheduleNoteEstimatedTrainingLoad,
  readWorkoutEstimatedTrainingLoad,
  sumCalendarEstimatedTrainingLoad,
} from '@/lib/training-load';

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
  estimatedTrainingLoad: number | null;
  adaptation: string;
}

function mapTrainingError(code: string): string {
  switch (code) {
    case 'pro_required':
      return 'AI TrainingAI training plan generation, including advanced plans, is a Max membership feature. This account is Free, Plus, or has an expired Max plan. Upgrade or redeem Max to unlock it.';
    case 'max_required':
      return 'AI TrainingAI training plan generation, including advanced plans, is a Max membership feature. This account is Free, Plus, or has an expired Max plan. Upgrade or redeem Max to unlock it.';
    case 'quota_exceeded':
      return 'This month’s AI plan generation limit has been reached.';
    default:
      return code || 'Generation failed. Please try again later.';
  }
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
  weeklyMaxMinutes: number | '';
  allowAdvancedWorkouts: boolean;
  allowDoubleDays: boolean;
  forceRequestedSchedule: boolean;
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
  weeklyMaxMinutes: 1200,
  allowAdvancedWorkouts: false,
  allowDoubleDays: false,
  forceRequestedSchedule: true,
  availableTime: '',
  preferredTrainingWindows: '',
  injuries: '',
  notes: '',
});

const REST_DAYS: { value: string; label: string }[] = [
  { value: '', label: 'No preference' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

function parseOptionalNumberInput(value: string): number | '' {
  if (value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function clampOptionalNumber(value: number | '', min: number, max: number): number | '' {
  if (value === '') return '';
  return Math.max(min, Math.min(max, value));
}

function buildPayload(f: FormState): TrainingPlanRequest | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.weekStartDate)) {
    return { error: 'Please select a Monday' };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.weekStartDate)!;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getDay() !== 1) return { error: 'The start date must be a Monday' };
  if (f.daysPerWeek < 1 || f.daysPerWeek > 7) return { error: 'Training days per weekneed 1–7' };
  if (!f.sportRunning && !f.sportCycling && !f.sportSwimming) return { error: 'Select at least one sport' };
  if (f.weeklyMaxMinutes !== '' && (f.weeklyMaxMinutes < 15 || f.weeklyMaxMinutes > 1200)) {
    return { error: 'Weekly duration limitneed 15–1200 minutes' };
  }
  if (f.dailyPreferredMinutes !== '' && (f.dailyPreferredMinutes < 15 || f.dailyPreferredMinutes > 1200)) {
    return { error: 'Preferred daily durationneed 15–1200 minutes' };
  }

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
    weeklyMaxMinutes:
      f.weeklyMaxMinutes === '' ? null : Number(f.weeklyMaxMinutes),
    allowAdvancedWorkouts: f.allowAdvancedWorkouts,
    allowDoubleDays: f.allowDoubleDays,
    forceRequestedSchedule: f.forceRequestedSchedule,
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
    targetHeartRate: String(raw.targetHeartRate ?? 'N/A'),
    targetPace: String(raw.targetPace ?? 'N/A'),
    targetPower: String(raw.targetPower ?? 'N/A'),
    workoutStructure: String(raw.workoutStructure ?? ''),
    targets: Array.isArray(raw.targets) ? (raw.targets as string[]) : [],
    estimatedTrainingLoad: readWorkoutEstimatedTrainingLoad(
      raw.parameterSource && typeof raw.parameterSource === 'object'
        ? raw.parameterSource as { replacedVariables?: Record<string, unknown> }
        : null,
    ),
    adaptation: String(raw.adaptation ?? ''),
  };
}

type TrainingModeSport = 'running' | 'cycling' | 'swimming';

const SPORT_OPTIONS: { k: TrainingModeSport; label: string; field: keyof FormState }[] = [
  { k: 'running', label: 'Running', field: 'sportRunning' },
  { k: 'cycling', label: 'Cycling', field: 'sportCycling' },
  { k: 'swimming', label: 'Swimming', field: 'sportSwimming' },
];

type TrainingMode = {
  name: string;
  phrase: string;
  kind: 'Base' | 'Advanced' | 'Specialized';
};

const TRAINING_MODE_GROUPS: Record<TrainingModeSport, { title: string; modes: TrainingMode[] }> = {
  running: {
    title: 'RunningTrainingMode',
    modes: [
      { name: 'Recovery run', phrase: 'onetimesRecovery run', kind: 'Base' },
      { name: 'Easy aerobic run', phrase: 'Schedule an aerobic run', kind: 'Base' },
      { name: 'LSD Long run', phrase: 'onetimes LSD Long run', kind: 'Base' },
      { name: 'Tempo Tempo run', phrase: 'onetimesTempo run', kind: 'Specialized' },
      { name: 'Threshold run', phrase: 'onetimesThreshold run', kind: 'Specialized' },
      { name: 'Short intervals 400/800m', phrase: 'Schedule 400/800 m intervals', kind: 'Advanced' },
      { name: 'Reverse pyramid intervals', phrase: 'Schedule reverse pyramid intervals', kind: 'Advanced' },
      { name: 'VO2max intervals', phrase: 'Schedule a running VO2max session', kind: 'Advanced' },
      { name: 'Uphill sprints', phrase: 'onetimesUphill sprints', kind: 'Advanced' },
      { name: 'Strides Strides', phrase: 'onetimesStrides', kind: 'Advanced' },
      { name: 'Progression run', phrase: 'onetimesProgression run', kind: 'Specialized' },
      { name: 'Race-pace workout', phrase: 'onetimesRace-pace workout', kind: 'Specialized' },
      { name: 'Double threshold AM/PM', phrase: 'Schedule a double-threshold session', kind: 'Advanced' },
    ],
  },
  cycling: {
    title: 'CyclingTrainingMode',
    modes: [
      { name: 'Recovery ride', phrase: 'onetimesRecovery ride', kind: 'Base' },
      { name: 'Z2 Endurance ride', phrase: 'onetimes Z2 Endurance ride', kind: 'Base' },
      { name: 'Long runEndurance ride', phrase: 'Schedule a long ride', kind: 'Base' },
      { name: 'Tempo ', phrase: 'Schedule a tempo ride', kind: 'Specialized' },
      { name: 'Sweet-spot ride', phrase: 'onetimesSweet-spot ride', kind: 'Specialized' },
      { name: 'Threshold ride', phrase: 'onetimesThreshold ride', kind: 'Specialized' },
      { name: 'VO2max ', phrase: 'Schedule a cycling VO2max session', kind: 'Advanced' },
      { name: 'NoneVO2max / 30-15', phrase: 'onetimes 30/15', kind: 'Advanced' },
      { name: 'Sprint ride', phrase: 'Schedule a sprint ride', kind: 'Advanced' },
      { name: 'Cadence technique ride', phrase: 'onetimesCadence technique ride', kind: 'Base' },
      { name: 'Climbing workout', phrase: 'Schedule a climbing ride', kind: 'Advanced' },
      { name: 'Over-under / Criss-cross', phrase: 'onetimes over-under', kind: 'Advanced' },
    ],
  },
  swimming: {
    title: 'SwimmingTrainingMode',
    modes: [
      { name: 'Recovery swim', phrase: 'onetimesRecovery swim', kind: 'Base' },
      { name: 'Technique swim', phrase: 'onetimesTechnique swim', kind: 'Base' },
      { name: 'Aerobic swim', phrase: 'onetimesAerobic swim', kind: 'Base' },
      { name: 'Long-set endurance swim', phrase: 'onetimesLong-set endurance swim', kind: 'Base' },
      { name: 'CSS / Threshold swim', phrase: 'onetimes CSS Threshold swim', kind: 'Specialized' },
      { name: 'VO2max ', phrase: 'Schedule a swimming VO2max session', kind: 'Advanced' },
      { name: 'Sprint swim', phrase: 'Schedule 50 m sprints', kind: 'Advanced' },
      { name: 'Pull-focused workout', phrase: 'onetimesPull-focused workout', kind: 'Specialized' },
      { name: 'Kick-focused workout', phrase: 'onetimesKick-focused workout', kind: 'Specialized' },
      { name: 'Open-water workout', phrase: 'onetimesOpen-water workout', kind: 'Advanced' },
    ],
  },
};

type View = 'form' | 'staging' | 'finishing';

export default function NewTrainingPlanPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [view, setView] = useState<View>('form');
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [workouts, setWorkouts] = useState<Map<number, CalendarCellWorkout[]>>(new Map());
  const [summary, setSummary] = useState<string>('');
  const [trainingCapacity, setTrainingCapacity] = useState<TrainingCapacityView | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState<string[]>([]);
  const [forceRequestedSchedule, setForceRequestedSchedule] = useState(false);
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
    setTrainingCapacity(null);
    setScheduleNotes([]);
    setForceRequestedSchedule(false);
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
      case 'context': {
        const capacity = data?.trainingCapacity;
        if (capacity && typeof capacity === 'object') {
          setTrainingCapacity(capacity as TrainingCapacityView);
        }
        setForceRequestedSchedule(data?.forceRequestedSchedule === true);
        return;
      }
      case 'schedule': {
        const rawDays = data && Array.isArray(data.days) ? data.days : [];
        const notes = data && Array.isArray(data.notes)
          ? data.notes.filter((n): n is string => typeof n === 'string')
          : [];
        setScheduleNotes(notes);
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
            sport: mapped.sport,
            slotIndex,
            durationMinutes: mapped.durationMinutes,
            distanceKm: mapped.distanceKm,
            targetMetric: mapped.targetMetric as CalendarCellWorkout['targetMetric'],
            targetPace: mapped.targetPace,
            targetHeartRate: mapped.targetHeartRate,
            estimatedTrainingLoad: mapped.estimatedTrainingLoad,
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
        const msg =
          data && typeof data.message === 'string'
            ? (data.message as string)
            : data && typeof data.error === 'string'
              ? (data.error as string)
              : 'GenerateFailed';
        fatalRef.current = mapTrainingError(msg);
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
    setForceRequestedSchedule(built.forceRequestedSchedule === true);

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
        const detail = (errObj as Error & { detail?: { error?: string; message?: string } }).detail;
        fatalRef.current = mapTrainingError(detail?.message ?? detail?.error ?? errObj.message);
      } else if (
        errObj.status === 409 &&
        (errObj as Error & { detail?: { error?: string; limit?: number } }).detail?.error ===
          'training_plan_limit_reached'
      ) {
        const limit = (errObj as Error & { detail?: { limit?: number } }).detail?.limit ?? 10;
        fatalRef.current = `You can keep at most ${limit} training plans at once. Delete an old plan before creating a new one.`;
      } else if (!ctrl.signal.aborted) {
        fatalRef.current = errObj.message || 'GenerateFailed';
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
      setError('GenerateCompleted，Get toplan ID。Please tolistView 。');
      setView('form');
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setView('form');
  }

  const selectedSports = SPORT_OPTIONS.filter((s) => form[s.field] === true);
  const eventsArray = useMemo(() => Array.from(toolEvents.values()), [toolEvents]);
  const streamedEstimatedTrainingLoad =
    sumCalendarEstimatedTrainingLoad(workouts) ?? readScheduleNoteEstimatedTrainingLoad(scheduleNotes);

  // ---- Staging / Finishing view ----
  if (view !== 'form') {
    const allDone = workouts.size >= (days?.length ?? 0) && (days?.length ?? 0) > 0;
    const statusLabel = view === 'finishing'
      ? 'Ready. Redirecting…'
      : allDone
        ? 'All sessions are ready'
        : 'Generating…';
    const statusTone = view === 'finishing' || allDone ? 'green' as const : 'cyan' as const;
    return (
      <>
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1.2 }}>
            // Generatein progress… Cancel to return to the form
          </span>
        </div>

        <PageHero
          eyebrow="AI Working"
          title="GenerateThis week’s plan"
          sub="AI CoachReading your Garmin data, arranging the schedule, and configuring each workout. The process is fully visible ↓"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
          <Card style={{ padding: 22 }}>
            <CardHeader
              eyebrow="This week’s plan"
              title="Monday → Sunday"
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {streamedEstimatedTrainingLoad != null && (
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.2 }}>
                      Estimated load {streamedEstimatedTrainingLoad}
                    </span>
                  )}
                  <span
                    className={view === 'staging' && !allDone ? 'track-blink' : ''}
                    style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan, letterSpacing: 1.2 }}
                  >
                    ● {workouts.size}/{days?.length ?? 7} Generated
                  </span>
                </div>
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

          <TrainingEvidencePanel
            capacity={trainingCapacity}
            scheduleNotes={scheduleNotes}
            forceRequestedSchedule={forceRequestedSchedule}
          />

          <CoachPanel
            events={eventsArray}
            summaryText={summary}
            status={{ label: statusLabel, anim: view === 'staging' && !allDone, tone: statusTone }}
            eyebrow="AI Live process"
            title="AI Coach"
            footer={
              view === 'staging' ? (
                <Btn variant="ghost" size="sm" onClick={handleCancel}>Canceland go back</Btn>
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
          ← Backlist
        </Link>
      </div>

      <PageHero
        eyebrow="New plan"
        title="Create training plan"
        sub="AI TrainingTraining plan generation is a Max feature. You can browse and fill out the form without Max; clicking Generate will prompt you to upgrade."
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 18 }}>
        <Card style={{ padding: 26 }}>
          <CardHeader eyebrow="Basic settings" title="Basic settings" />
          <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="Sports" full>
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
              <TrainingModeGuide selectedSports={selectedSports.map((s) => s.k)} />
            </Field>

            <Field label="Goal">
              <TrackInput
                value={form.goal}
                onChange={(e) => setField('goal', e.target.value)}
                maxLength={500}
                placeholder="Half-marathon PB / first completed marathon / improve endurance"
              />
            </Field>

            <Field label="GoalDistance">
              <TrackInput
                mono
                value={form.goalDistance}
                onChange={(e) => setField('goalDistance', e.target.value)}
                maxLength={50}
                placeholder="21.1km / 10km / 100km bike"
              />
            </Field>

            <Field label="Monday date">
              <TrackInput
                type="date"
                value={form.weekStartDate}
                onChange={(e) => setField('weekStartDate', e.target.value)}
                required
              />
            </Field>

            <Field label="Race date(optional)">
              <TrackInput
                type="date"
                value={form.raceDate}
                onChange={(e) => setField('raceDate', e.target.value)}
              />
            </Field>

            <Field label={`Training days per week · ${form.daysPerWeek} days`} full>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
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

            <Field label="Preferred rest days">
              <TrackSelect
                value={form.preferredRestDay}
                onChange={(e) => setField('preferredRestDay', e.target.value)}
              >
                {REST_DAYS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </TrackSelect>
            </Field>

            <Field label="Primary sport">
              <TrackSelect
                value={form.sportPriority}
                onChange={(e) => setField('sportPriority', e.target.value as SportPriorityChoice)}
              >
                <option value="auto">Auto</option>
                <option value="running">Runningpreferred</option>
                <option value="cycling">Cyclingpreferred</option>
                <option value="swimming">Swimmingpreferred</option>
              </TrackSelect>
            </Field>

            <Field label="Primary metric" full>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { v: 'auto', label: 'Auto' },
                  { v: 'heart_rate', label: 'Heart rate first' },
                  { v: 'pace', label: 'Pace first' },
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

            <Field label="Weekly high-intensity limit">
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
                placeholder="Leave blank = Auto"
              />
            </Field>

            <Field label="Preferred daily duration">
              <TrackInput
                type="number"
                min={15}
                max={1200}
                value={form.dailyPreferredMinutes}
                onChange={(e) => {
                  setField('dailyPreferredMinutes', parseOptionalNumberInput(e.target.value));
                }}
                onBlur={() => {
                  setField('dailyPreferredMinutes', clampOptionalNumber(form.dailyPreferredMinutes, 15, 1200));
                }}
                placeholder="：75"
              />
            </Field>

            <Field label="Weekly duration limit">
              <TrackInput
                type="number"
                min={15}
                max={1200}
                value={form.weeklyMaxMinutes}
                onChange={(e) => {
                  setField('weeklyMaxMinutes', parseOptionalNumberInput(e.target.value));
                }}
                onBlur={() => {
                  setField('weeklyMaxMinutes', clampOptionalNumber(form.weeklyMaxMinutes, 15, 1200));
                }}
                placeholder="Default 1200"
              />
            </Field>

            <Field label="Available time(optional)">
              <TrackInput
                value={form.availableTime}
                onChange={(e) => setField('availableTime', e.target.value)}
                maxLength={200}
                placeholder="60 minutes on weekdays / 90+ minutes on weekends"
              />
            </Field>

            <Field label="Preferred time">
              <TrackInput
                value={form.preferredTrainingWindows}
                onChange={(e) => setField('preferredTrainingWindows', e.target.value)}
                maxLength={200}
                placeholder="Morning, Evening"
              />
            </Field>

            <Field label="Advanced training" full>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.inkDim, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.allowAdvancedWorkouts}
                  onChange={(e) => {
                    setField('allowAdvancedWorkouts', e.target.checked);
                    if (!e.target.checked) setField('allowDoubleDays', false);
                  }}
                />
                Allowed VO2max、Advanced workouts such as short intervals, VO2max, sprints, hills, and race-specific sessions
              </label>
            </Field>

            <Field label="Multiple sessions / double days" full>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.inkDim, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.allowDoubleDays}
                  disabled={!form.allowAdvancedWorkouts}
                  onChange={(e) => setField('allowDoubleDays', e.target.checked)}
                />
                Allowedonedays，threshold；inAdvanced trainingOn
              </label>
            </Field>

            <Field label="Generate strictly to requirements" full>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.inkDim, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.forceRequestedSchedule}
                  onChange={(e) => setField('forceRequestedSchedule', e.target.checked)}
                />
                DefaultOn：Generate according to the training days, duration, and intensity preferences entered; show capacity and recovery issues as warnings only
              </label>
            </Field>

            <Field label="Injury constraints" full>
              <TrackTextarea
                value={form.injuries}
                onChange={(e) => setField('injuries', e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Example: sensitive left knee cartilage; avoid extensive downhill running"
              />
            </Field>

            <Field label="Notes" full>
              <TrackTextarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Anything you want the AI Coach to know…"
              />
            </Field>

            <div style={{ gridColumn: '1 / -1', marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
              <Link href="/training" style={{ textDecoration: 'none' }}>
                <Btn variant="ghost" type="button">Back</Btn>
              </Link>
              <Btn type="submit">
                Generateplan →
              </Btn>
            </div>
          </form>
        </Card>

        <Card style={{ padding: 22, alignSelf: 'start' }}>
          <CardHeader eyebrow="AI Preview" title="AI willEnter " />
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Row k="Monday date" v={form.weekStartDate} c={T.lime} />
            <Row k="Days per week" v={`${form.daysPerWeek} days`} />
            <Row k="Sports" v={selectedSports.length ? selectedSports.map((s) => SPORT_META[s.k].label).join(' · ') : '—'} c={T.cyan} />
            <Row k="Primary sport" v={form.sportPriority === 'auto' ? 'Auto' : SPORT_META[form.sportPriority as SportKind].label} />
            <Row k="Primary metric" v={form.targetMetricPreference === 'auto' ? 'Auto' : form.targetMetricPreference === 'heart_rate' ? 'Heart rate first' : 'Pace first'} />
            <Row k="High intensity" v={form.maxHardSessionsPerWeek === '' ? 'Auto' : `${form.maxHardSessionsPerWeek} sessions/week`} />
            <Row k="Weekly duration" v={form.weeklyMaxMinutes === '' ? 'Default 1200 minutes' : `${form.weeklyMaxMinutes} minutes`} />
            <Row k="Advanced workouts" v={form.allowAdvancedWorkouts ? 'Allowed' : 'Close'} />
            <Row k="Double days" v={form.allowDoubleDays ? 'Allowed' : 'Close'} />
            <Row k="Strict mode" v={form.forceRequestedSchedule ? 'On' : 'Close'} c={form.forceRequestedSchedule ? T.amber : undefined} />
          </div>
          <div style={{
            marginTop: 16, padding: 12, fontFamily: T.mono, fontSize: 11,
            color: T.inkDim, lineHeight: 1.7, background: 'rgba(0,0,0,0.25)',
            border: `1px solid ${T.border}`, borderRadius: 6,
          }}>
            <span style={{ color: T.cyan }}>● </span>
            After clicking Generate, the AI Coach view will show data loading, schedule planning, parameterization, and validation step by step.
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

function TrainingModeGuide({ selectedSports }: { selectedSports: TrainingModeSport[] }) {
  const [openGroups, setOpenGroups] = useState<Record<TrainingModeSport, boolean>>({
    running: false,
    cycling: false,
    swimming: false,
  });
  if (selectedSports.length === 0) return null;
  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
      <div style={{
        padding: '10px 12px',
        borderRadius: 6,
        border: `1px solid ${T.border}`,
        background: 'rgba(0,0,0,0.18)',
        color: T.inkDim,
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        ifneedTraining，caninNotesdirectly，For example「Schedule a running VO2max session」or「weekneedonetimes over-under」。
        Advanced workoutssuggestionsOnbelow「Advanced training」，DurationplansuggestionsOn「onedaysDouble days」。
      </div>

      {selectedSports.map((sport) => {
        const meta = SPORT_META[sport];
        const group = TRAINING_MODE_GROUPS[sport];
        const isOpen = openGroups[sport];
        return (
          <details
            key={sport}
            open={isOpen}
            onToggle={(e) => {
              const next = e.currentTarget.open;
              setOpenGroups((prev) => (prev[sport] === next ? prev : { ...prev, [sport]: next }));
            }}
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              background: 'rgba(0,0,0,0.16)',
              overflow: 'hidden',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                listStyle: 'none',
                padding: '11px 12px',
                color: meta.color,
                fontFamily: T.sans,
                fontSize: 13,
                fontWeight: 650,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span>{group.title}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.1 }}>
                {group.modes.length} types · {isOpen ? 'Click to collapse' : 'Click to expand'}
              </span>
            </summary>
            <div style={{
              borderTop: `1px solid ${T.border}`,
              padding: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 8,
            }}>
              {group.modes.map((mode) => (
                <div
                  key={mode.name}
                  style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: '9px 10px',
                    background: 'rgba(255,255,255,0.025)',
                    minWidth: 0,
                  }}
                  title={`Notes example: ${mode.phrase}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: T.ink, fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
                      {mode.name}
                    </span>
                    <span style={{
                      flexShrink: 0,
                      fontFamily: T.mono,
                      fontSize: 9,
                      color: mode.kind === 'Advanced' ? T.amber : mode.kind === 'Specialized' ? T.cyan : T.inkFaint,
                      border: `1px solid ${mode.kind === 'Advanced' ? T.amber : mode.kind === 'Specialized' ? T.cyan : T.border}55`,
                      borderRadius: 4,
                      padding: '1px 5px',
                    }}>
                      {mode.kind}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 5,
                    color: T.inkFaint,
                    fontFamily: T.mono,
                    fontSize: 10,
                    lineHeight: 1.45,
                    overflowWrap: 'anywhere',
                  }}>
                    {mode.phrase}
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
