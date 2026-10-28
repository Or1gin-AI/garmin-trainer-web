'use client';

import type { TrainingWorkout } from '@/lib/api';
import {
  T, Btn, Card, StatusBadge, IntensityMeter, SportTag, LABEL, SPORT,
  type StatusKind, type IntensityKind, type SportKind,
} from '@/components/track';
import { readWorkoutEstimatedTrainingLoad } from '@/lib/training-load';

const STATUS_MAP: Record<TrainingWorkout['status'], StatusKind> = {
  planned: 'planned',
  completed: 'completed',
  skipped: 'skipped',
  regenerating: 'regenerating',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TIME_OF_DAY: Record<string, string> = {
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

function formatDay(d: string): { weekday: string; date: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return { weekday: '', date: d };
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return { weekday: WEEKDAYS[date.getDay()], date: `${MONTHS[date.getMonth()]} ${date.getDate()}` };
}

function usable(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || /^(n\/?a|none|—|-|不适用|无)$/i.test(v)) return null;
  return v;
}

type Target = { label: string; value: string; primary?: boolean };

function targetsOf(w: TrainingWorkout): Target[] {
  const rows: Target[] = [];
  const hr = usable(w.targetHeartRate);
  const pace = usable(w.targetPace);
  const power = usable(w.targetPower);
  if (hr) rows.push({ label: 'Heart rate', value: hr, primary: w.targetMetric === 'heart_rate' || w.targetMetric === 'mixed' });
  if (pace) rows.push({ label: 'Pace', value: pace, primary: w.targetMetric === 'pace' || w.targetMetric === 'mixed' });
  if (power) rows.push({ label: 'Power', value: power, primary: w.targetMetric === 'power' || w.targetMetric === 'mixed' });
  return rows;
}

type Phase = 'warmup' | 'main' | 'recovery' | 'cooldown' | 'other';

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  warmup: { label: 'Warm-up', color: T.cyan },
  main: { label: 'Main set', color: T.lime },
  recovery: { label: 'Recovery', color: T.green },
  cooldown: { label: 'Cool-down', color: T.violet },
  other: { label: 'Session', color: T.inkDim },
};

function phaseOf(text: string): Phase {
  const t = text.toLowerCase();
  if (/^(warm[\s-]?up|热身)/.test(t)) return 'warmup';
  if (/^(cool[\s-]?down|放松|冷身)/.test(t)) return 'cooldown';
  if (/^(main|主训练|主课)/.test(t)) return 'main';
  if (/^(recover|between|组间)/.test(t)) return 'recovery';
  return 'other';
}

/** Break the free-text structure into steps ("Warm-up …; Main set …; Cool-down …"). */
function structureSteps(text: string): Array<{ phase: Phase; text: string }> {
  const parts = text
    .split(/\n+|[;；]\s*|(?<=\.)\s+(?=(?:Warm|Main|Cool|Recover|Between)\b)|。/i)
    .map((s) => s.trim().replace(/[.。]$/, ''))
    .filter(Boolean);
  return parts.map((p) => {
    const phase = phaseOf(p);
    const stripped = phase === 'other'
      ? p
      : p.replace(/^(warm[\s-]?up|cool[\s-]?down|main set|main|recovery|热身|放松|主训练)\s*[:：]?\s*/i, '');
    return { phase, text: stripped.charAt(0).toUpperCase() + stripped.slice(1) };
  });
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Warm-up / main / cool-down minutes from the template variables, when present. */
function phaseSplit(w: TrainingWorkout): Array<{ phase: Phase; minutes: number }> | null {
  const v = w.parameterSource?.replacedVariables ?? {};
  const warm = num(v.warmupDuration);
  const cool = num(v.cooldownDuration);
  let main = num(v.mainDuration) ?? num(v.mainDurationTotal);
  if (!warm && !cool) return null;
  const total = w.durationMinutes ?? 0;
  if (total > 0) main = Math.max(total - (warm ?? 0) - (cool ?? 0), main ?? 0);
  const out: Array<{ phase: Phase; minutes: number }> = [];
  if (warm) out.push({ phase: 'warmup', minutes: Math.round(warm) });
  if (main) out.push({ phase: 'main', minutes: Math.round(main) });
  if (cool) out.push({ phase: 'cooldown', minutes: Math.round(cool) });
  return out.length >= 2 ? out : null;
}

export interface WorkoutCardProps {
  workout: TrainingWorkout;
  highlighted?: boolean;
  busy?: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onRegenerate: () => void;
}

export function WorkoutCard({
  workout: w,
  highlighted,
  busy,
  onComplete,
  onSkip,
  onRegenerate,
}: WorkoutCardProps) {
  const isRest = w.sport === 'rest';
  const intensityKind: IntensityKind = isRest ? 'rest' : (w.intensity ?? 'low');
  const sportKind = w.sport as SportKind;
  const sportMeta = SPORT[sportKind] ?? SPORT.running;
  const { weekday, date } = formatDay(w.date);
  const estimatedLoad = readWorkoutEstimatedTrainingLoad(w.parameterSource);
  const targets = targetsOf(w);
  const steps = w.workoutStructure ? structureSteps(w.workoutStructure) : [];
  const split = isRest ? null : phaseSplit(w);
  const keyPoints = (w.targets ?? []).filter((t) => !/^(total duration|总时长)\s*(n\/a|不适用)?$/i.test(t.trim()));

  const accent = highlighted ? T.amber : w.status === 'regenerating' ? T.cyan : sportMeta.color;

  return (
    <Card
      hot={highlighted}
      glow={highlighted}
      style={{ padding: 0, opacity: busy ? 0.7 : 1, transition: 'opacity .15s' }}
      accent={accent}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '22px 22px 18px', flexWrap: 'wrap' }}>
        <div style={{
          width: 64, flexShrink: 0, textAlign: 'center', padding: '8px 0', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
        }}>
          <div style={{ ...LABEL, fontSize: 10, color: sportMeta.color }}>{weekday.slice(0, 3)}</div>
          <div style={{ fontSize: 22, fontWeight: 750, color: T.ink, lineHeight: 1.1, marginTop: 2 }}>{date.split(' ')[1]}</div>
          <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 1 }}>{date.split(' ')[0]}</div>
        </div>

        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <div style={{ fontSize: 13, color: T.inkFaint, marginBottom: 4 }}>
            {weekday}{w.sessionLabel ? ` · ${w.sessionLabel}` : ''}{w.timeOfDay ? ` · ${TIME_OF_DAY[w.timeOfDay] ?? w.timeOfDay}` : ''}
          </div>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 750, letterSpacing: '-0.015em', color: T.ink, lineHeight: 1.25 }}>
            {w.title || sportMeta.label}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <SportTag kind={sportKind} />
            {!isRest && w.intensity && <IntensityMeter kind={intensityKind} label />}
            {w.status !== 'planned' && <StatusBadge kind={STATUS_MAP[w.status]} size="sm" />}
          </div>
        </div>

        {!isRest && (
          <div style={{ display: 'flex', gap: 22, flexShrink: 0 }}>
            {w.durationMinutes != null && w.durationMinutes > 0 && <HeaderStat label="Duration" value={`${w.durationMinutes}`} unit="min" />}
            {w.distanceKm != null && Number(w.distanceKm) > 0 && <HeaderStat label="Distance" value={Number(w.distanceKm).toFixed(1)} unit="km" />}
            {estimatedLoad != null && <HeaderStat label="Load" value={`${estimatedLoad}`} color={T.lime} />}
          </div>
        )}
      </div>

      {isRest ? (
        <div style={{ padding: '0 22px 22px' }}>
          <div style={{
            padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: `1px dashed ${T.borderStrong}`,
            fontSize: 14, color: T.inkDim, lineHeight: 1.6,
          }}>
            <div style={{ color: T.ink, fontWeight: 600, marginBottom: 4 }}>Full rest day</div>
            {steps.length > 0 && steps[0].text && !/^(full )?rest/i.test(steps[0].text) ? steps.map((s) => s.text).join('. ') : 'No training today. Prioritize sleep, hydration and an easy walk if you feel like moving — recovery is where adaptation happens.'}
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 22px 20px', display: 'grid', gap: 18 }}>
          {/* Targets */}
          {(targets.length > 0 || split) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {targets.map((t) => (
                <div key={t.label} style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: t.primary ? T.limeGlow : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${t.primary ? `${T.lime}55` : T.border}`,
                }}>
                  <div style={{ ...LABEL, fontSize: 10, color: t.primary ? T.lime : T.inkFaint, marginBottom: 4 }}>
                    {t.label}{t.primary ? ' · primary target' : ''}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Phase bar */}
          {split && (
            <div>
              <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
                {split.map((p) => (
                  <div key={p.phase} style={{ flex: p.minutes, background: PHASE_META[p.phase].color, opacity: p.phase === 'main' ? 1 : 0.6 }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                {split.map((p) => (
                  <span key={p.phase} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.inkDim }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PHASE_META[p.phase].color }} />
                    {PHASE_META[p.phase].label} <span style={{ color: T.ink, fontWeight: 600 }}>{p.minutes} min</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Structure */}
          {steps.length > 0 && (
            <div>
              <div style={{ ...LABEL, marginBottom: 10 }}>Session structure</div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 0 }}>
                {steps.map((s, i) => {
                  const meta = PHASE_META[s.phase];
                  const last = i === steps.length - 1;
                  return (
                    <li key={i} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: meta.color, marginTop: 5, boxShadow: `0 0 0 3px ${meta.color}22` }} />
                        {!last && <span style={{ flex: 1, width: 2, background: T.border, marginTop: 4 }} />}
                      </div>
                      <div style={{ paddingBottom: last ? 0 : 14 }}>
                        {s.phase !== 'other' && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 2 }}>{meta.label}</div>
                        )}
                        <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.6 }}>{s.text}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Key points */}
          {keyPoints.length > 0 && (
            <div>
              <div style={{ ...LABEL, marginBottom: 10 }}>Key points</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                {keyPoints.map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: T.ink, lineHeight: 1.55 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: T.limeGlow, color: T.lime, fontSize: 11, fontWeight: 800,
                    }}>✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Adaptation */}
          {w.adaptation && (
            <div style={{
              padding: 14, background: T.amberSoft, border: `1px solid ${T.amber}30`,
              borderRadius: 12, fontSize: 14, color: T.ink, lineHeight: 1.6,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.amber, marginBottom: 4 }}>If you need to adjust</div>
              {w.adaptation}
            </div>
          )}

          {steps.length === 0 && keyPoints.length === 0 && !w.adaptation && (
            <div style={{ fontSize: 13, color: T.inkFaint }}>No further details for this session.</div>
          )}
        </div>
      )}

      {!isRest && (
        <div style={{
          display: 'flex', gap: 8, padding: '12px 22px',
          borderTop: `1px solid ${T.border}`, background: 'rgba(0,0,0,0.18)',
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ flex: 1, fontSize: 12, color: T.inkFaint, minWidth: 160 }}>
            {w.status === 'completed' ? 'Nice work — session logged.' : w.status === 'skipped' ? 'Marked as skipped.' : 'Done with this session? Log it here.'}
          </span>
          <Btn variant="ghost" size="sm" onClick={onRegenerate} disabled={busy}>↻ Regenerate</Btn>
          <Btn variant="ghost" size="sm" onClick={onSkip} disabled={busy || w.status === 'skipped'}>
            {w.status === 'skipped' ? 'Skipped' : 'Skip'}
          </Btn>
          <Btn variant="ok" size="sm" onClick={onComplete} disabled={busy || w.status === 'completed'}>
            {w.status === 'completed' ? '✓ Completed' : 'Mark complete'}
          </Btn>
        </div>
      )}
    </Card>
  );
}

function HeaderStat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ ...LABEL, fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 750, color: color ?? T.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {unit && <span style={{ fontSize: 12, fontWeight: 500, color: T.inkFaint, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}
