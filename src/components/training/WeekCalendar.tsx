'use client';

import { T, SPORT, INTENSITY, type SportKind, type IntensityKind } from '@/components/track';
import type { Sport, TargetMetric, TrainingWorkout, WorkoutStatus } from '@/lib/api';

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
  completed: { color: T.green, label: '完成' },
  skipped: { color: T.amber, label: '跳过' },
  regenerating: { color: T.cyan, label: '更新' },
};

function formatMD(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${Number(m[2])}/${Number(m[3])}`;
}

const WEEKDAY_ZH = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function usableTarget(value: string | undefined): string | null {
  return value && value !== '不适用' ? value : null;
}

function primaryTarget(w: CalendarCellWorkout): string | null {
  const hr = usableTarget(w.targetHeartRate);
  const pace = usableTarget(w.targetPace);
  if (w.targetMetric === 'heart_rate') return hr;
  if (w.targetMetric === 'pace') return pace;
  return hr ?? pace;
}

function intensityRank(value: CalendarCellWorkout['intensity']): number {
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  if (value === 'low') return 1;
  return 0;
}

function formatWorkoutLine(item: CalendarCellWorkout, index: number, total: number): string {
  const prefix = total > 1 ? `训练 ${index + 1} · ` : '';
  const minutes =
    item.durationMinutes !== null &&
    item.durationMinutes !== undefined &&
    item.durationMinutes > 0
      ? ` · ${item.durationMinutes}min`
      : '';
  return `${prefix}${item.title || '—'}${minutes}`;
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
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
        const sportLabel = sport ? `${sport.code} · ${sport.label}` : null;
        const selected = selectedDayIndex === idx;
        const highlighted = highlightedDayIndex === idx;
        const isRest = sportKind === 'rest' || sportKind === 'mobility';
        const statusDot = items.find((item) => item.status && item.status !== 'planned')?.status
          ? STATUS_DOT[items.find((item) => item.status && item.status !== 'planned')!.status!]
          : w?.status
            ? STATUS_DOT[w.status]
            : null;
        const totalDuration = items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
        const totalDistance = items.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0);
        const dayIntensity = items
          .map((item) => item.intensity)
          .sort((a, b) => intensityRank(b) - intensityRank(a))[0] ?? null;

        const clickable = !isGeneration && day != null && onSelectDay;

        const borderColor = highlighted
          ? T.amber
          : selected
            ? T.lime
            : T.border;
        const bg = selected
          ? 'rgba(198,255,58,0.04)'
          : 'rgba(255,255,255,0.02)';

        return (
          <button
            key={idx}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelectDay!(idx)}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: clickable ? 'pointer' : 'default',
              border: `1px solid ${borderColor}`,
              borderRadius: 10,
              padding: 10,
              minHeight: 116,
              background: bg,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              transition: 'border-color .12s, background .12s',
              boxShadow: highlighted ? `0 0 18px ${T.amber}26` : 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: selected ? T.lime : T.inkFaint,
                  letterSpacing: 1.2,
                  fontWeight: 600,
                }}
              >
                {WEEKDAY_ZH[idx]}
              </span>
              {day?.date && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10,
                    color: T.inkFaint,
                  }}
                >
                  {formatMD(day.date)}
                </span>
              )}
            </div>

            <div style={{ minHeight: 14 }}>
              {itemSports.length > 1 ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: T.mono,
                    fontSize: 10.5,
                    letterSpacing: 0.5,
                    fontWeight: 600,
                    flexWrap: 'wrap',
                  }}
                >
                  {itemSports.map((s, sportIdx) => {
                    const meta = SPORT[s as SportKind];
                    return (
                      <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {sportIdx > 0 ? <span style={{ color: T.inkFaint }}>+</span> : null}
                        <span style={{ color: meta?.color ?? T.inkDim }}>
                          {meta?.code ?? String(s).toUpperCase()}
                        </span>
                      </span>
                    );
                  })}
                </span>
              ) : sportLabel ? (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10.5,
                    color: sport?.color ?? T.inkDim,
                    letterSpacing: 0.5,
                    fontWeight: 600,
                  }}
                >
                  {sportLabel}
                </span>
              ) : (
                <span
                  className="track-blink"
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10,
                    color: T.inkFaint,
                    letterSpacing: 1.2,
                  }}
                >
                  …等待
                </span>
              )}
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 30,
                fontSize: 12,
                color: T.ink,
                lineHeight: 1.4,
                wordBreak: 'break-word',
                opacity: w ? 1 : 0.55,
              }}
            >
              {items.length > 0 ? (
                items.map((item, itemIdx) => (
                  <div key={`${item.title}-${itemIdx}`} style={{ marginBottom: itemIdx < items.length - 1 ? 4 : 0 }}>
                    {formatWorkoutLine(item, itemIdx, items.length)}
                  </div>
                ))
              ) : day ? (
                <span
                  className="track-blink"
                  style={{ fontFamily: T.mono, color: T.inkFaint }}
                >
                  …生成中
                </span>
              ) : (
                ''
              )}
            </div>

            {w && !isRest && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  minWidth: 0,
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.inkDim,
                  whiteSpace: 'nowrap',
                }}
              >
                {dayIntensity && (() => {
                  const ik = INTENSITY[dayIntensity as IntensityKind] ?? INTENSITY.low;
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 2,
                      minWidth: 0, flexShrink: 1,
                    }}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{
                          width: 3, height: 10,
                          background: i < ik.bars ? ik.color : T.borderStrong,
                          opacity: i < ik.bars ? 1 : 0.3,
                          borderRadius: 1,
                        }} />
                      ))}
                      <span style={{ color: ik.color, marginLeft: 2, fontSize: 9 }}>{ik.code}</span>
                    </span>
                  );
                })()}
                {totalDistance > 0 && (
                  <span style={{ flexShrink: 0 }}>{Number(totalDistance).toFixed(1)}km</span>
                )}
                {totalDuration > 0 && (
                  <span style={{ flexShrink: 0 }}>{totalDuration}min</span>
                )}
              </div>
            )}

            {statusDot && (
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 9,
                  color: statusDot.color,
                  letterSpacing: 1,
                }}
              >
                ● {statusDot.label}
              </div>
            )}
          </button>
        );
      })}
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
    intensity: w.intensity,
    status: w.status,
  };
}
