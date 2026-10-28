'use client';

import { T, SPORT, INTENSITY, type SportKind, type IntensityKind } from '@/components/track';
import type { Sport, TargetMetric, TrainingWorkout, WorkoutStatus } from '@/lib/api';
import { readWorkoutEstimatedTrainingLoad } from '@/lib/training-load';

export interface CalendarDay {
  dayIndex: number;
  date: string;
  dayLabel?: string;
  sport: Sport;
}

export interface CalendarCellWorkout {
  title: string;
  sport?: Sport;
  slotIndex?: number | null;
  sessionLabel?: string | null;
  durationMinutes?: number | null;
  distanceKm?: number | null;
  targetMetric?: TargetMetric;
  targetPace?: string;
  targetHeartRate?: string;
  estimatedTrainingLoad?: number | null;
  intensity?: 'low' | 'medium' | 'high' | null;
  status?: WorkoutStatus;
}

export interface WeekCalendarProps {
  days: CalendarDay[] | null;
  workouts: Map<number, CalendarCellWorkout | CalendarCellWorkout[]>;
  selectedDayIndex?: number | null;
  highlightedDayIndex?: number | null;
  onSelectDay?: (dayIndex: number) => void;
  mode?: 'generation' | 'detail';
}

const STATUS_DOT: Record<WorkoutStatus, { color: string; label: string } | null> = {
  planned: null,
  completed: { color: T.green, label: 'Done' },
  skipped: { color: T.amber, label: 'Skipped' },
  regenerating: { color: T.cyan, label: 'Updating' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseDate(d: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatMD(d: string): string {
  const date = parseDate(d);
  if (!date) return d;
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function isToday(d: string): boolean {
  const date = parseDate(d);
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function intensityRank(value: CalendarCellWorkout['intensity']): number {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  if (value === 'low') return 1;
  return 0;
}

export function WeekCalendar({
  days,
  workouts,
  selectedDayIndex,
  highlightedDayIndex,
  onSelectDay,
  mode = 'detail',
}: WeekCalendarProps) {
  const isGeneration = mode === 'generation';
  return (
    <div className="track-scroll-x" style={{ overflowX: 'auto', margin: '0 -2px', padding: '2px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(94px, 1fr))',
          gap: 8,
        }}
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const idx = i + 1;
          const day = days?.find((d) => d.dayIndex === idx) ?? null;
          const raw = workouts.get(idx) ?? null;
          const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
          const w = items[0] ?? null;
          const itemSports = Array.from(
            new Set(items.map((item) => item.sport).filter(Boolean)),
          ) as Sport[];
          const sportKind = (itemSports[0] as SportKind | undefined) ?? (day?.sport as SportKind | undefined) ?? null;
          const sport = sportKind ? SPORT[sportKind] : null;
          const selected = selectedDayIndex === idx;
          const highlighted = highlightedDayIndex === idx;
          const isRest = sportKind === 'rest';
          const today = day?.date ? isToday(day.date) : false;
          const statusItem = items.find((item) => item.status && item.status !== 'planned');
          const statusDot = statusItem?.status ? STATUS_DOT[statusItem.status] : null;
          const totalDuration = items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
          const totalDistance = items.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0);
          const totalLoad = items.reduce((sum, item) => sum + (item.estimatedTrainingLoad ?? 0), 0);
          const dayIntensity = items
            .map((item) => item.intensity)
            .sort((a, b) => intensityRank(b) - intensityRank(a))[0] ?? null;
          const ik = dayIntensity ? INTENSITY[dayIntensity as IntensityKind] ?? INTENSITY.low : null;

          const clickable = !isGeneration && day != null && onSelectDay;
          const stripe = sport?.color ?? T.border;

          const borderColor = highlighted
            ? T.amber
            : selected
              ? `${T.lime}aa`
              : T.border;
          const bg = selected
            ? 'linear-gradient(180deg, rgba(198,255,58,0.09), rgba(198,255,58,0.02))'
            : isRest
              ? 'rgba(255,255,255,0.012)'
              : 'rgba(255,255,255,0.03)';

          return (
            <button
              key={idx}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelectDay!(idx)}
              className="track-day"
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
                cursor: clickable ? 'pointer' : 'default',
                border: `1px solid ${borderColor}`,
                borderRadius: 12,
                padding: '14px 12px 12px',
                minHeight: 150,
                background: bg,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: highlighted ? `0 0 18px ${T.amber}26` : selected ? `0 6px 24px ${T.limeGlow}` : 'none',
              }}
            >
              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stripe, opacity: isRest ? 0.35 : 0.9 }} />

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: selected || today ? T.lime : T.inkDim }}>
                  {WEEKDAY_SHORT[idx]}
                </span>
                {day?.date && (
                  <span style={{ fontSize: 11, color: T.inkFaint }}>{formatMD(day.date)}</span>
                )}
              </div>
              {today && (
                <span style={{
                  alignSelf: 'flex-start', marginTop: -4, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                  color: T.bg, background: T.lime, padding: '1px 6px', borderRadius: 999,
                }}>TODAY</span>
              )}

              <div style={{ flex: 1, minHeight: 34, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.length > 0 ? (
                  items.map((item, itemIdx) => {
                    const itemSport = item.sport ? SPORT[item.sport as SportKind] : sport;
                    return (
                      <div key={`${item.title}-${itemIdx}`}>
                        {items.length > 1 && (
                          <div style={{ fontSize: 10, fontWeight: 700, color: itemSport?.color ?? T.inkDim, marginBottom: 1 }}>
                            {itemSport?.label ?? 'Session'} {itemIdx + 1}
                          </div>
                        )}
                        <div style={{
                          fontSize: 13.5, fontWeight: isRest ? 500 : 650, lineHeight: 1.3,
                          color: isRest ? T.inkFaint : T.ink, wordBreak: 'break-word',
                        }}>
                          {item.title || '—'}
                        </div>
                      </div>
                    );
                  })
                ) : day ? (
                  <span className="track-blink" style={{ fontSize: 12, color: T.inkFaint }}>Planning…</span>
                ) : (
                  <span className="track-blink" style={{ fontSize: 12, color: T.inkFaint }}>Waiting…</span>
                )}
              </div>

              {w && !isRest && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 12, color: T.inkDim, fontVariantNumeric: 'tabular-nums' }}>
                    {totalDuration > 0 && <span style={{ color: T.ink, fontWeight: 650 }}>{totalDuration} min</span>}
                    {totalDistance > 0 && <span>{Number(totalDistance).toFixed(1)} km</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    {ik && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end' }}>
                          {[0, 1, 2].map((b) => (
                            <span key={b} style={{
                              width: 3, height: 5 + b * 3, borderRadius: 1,
                              background: b < ik.bars ? ik.color : T.borderStrong,
                            }} />
                          ))}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: ik.color }}>{ik.label}</span>
                      </span>
                    )}
                    {totalLoad > 0 && (
                      <span style={{ fontSize: 11, color: T.inkFaint }}>Load {totalLoad}</span>
                    )}
                  </div>
                </div>
              )}

              {statusDot && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: statusDot.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: statusDot.color }} />
                  {statusDot.label}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Convert a TrainingWorkout (from detail page API) to the calendar cell shape. */
export function toCalendarCell(w: TrainingWorkout): CalendarCellWorkout {
  return {
    title: w.title,
    sport: w.sport,
    slotIndex: w.slotIndex,
    sessionLabel: w.sessionLabel,
    durationMinutes: w.durationMinutes ?? null,
    distanceKm: w.distanceKm ?? null,
    targetMetric: w.targetMetric,
    targetPace: w.targetPace,
    targetHeartRate: w.targetHeartRate,
    estimatedTrainingLoad: readWorkoutEstimatedTrainingLoad(w.parameterSource),
    intensity: w.intensity,
    status: w.status,
  };
}
