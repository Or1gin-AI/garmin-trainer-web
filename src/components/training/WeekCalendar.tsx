'use client';

import { T, SPORT, type SportKind } from '@/components/track';
import type { Sport, TargetMetric, TrainingWorkout, WorkoutStatus } from '@/lib/api';

export interface CalendarDay {
  dayIndex: number;
  date: string;
  dayLabel?: string;
  sport: Sport;
}

export interface CalendarCellWorkout {
  title: string;
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
        const sportKind = (day?.sport as SportKind | undefined) ?? null;
        const sport = sportKind ? SPORT[sportKind] : null;
        const selected = selectedDayIndex === idx;
        const highlighted = highlightedDayIndex === idx;
        const isRest = sportKind === 'rest' || sportKind === 'mobility';
        const statusDot = w?.status ? STATUS_DOT[w.status] : null;

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
              {sport ? (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10.5,
                    color: sport.color,
                    letterSpacing: 0.5,
                    fontWeight: 600,
                  }}
                >
                  {sport.code} · {sport.label}
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
                    {items.length > 1 && item.sessionLabel ? `${item.sessionLabel} · ` : ''}
                    {item.title || '—'}
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
                  flexWrap: 'wrap',
                  gap: 6,
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.inkDim,
                }}
              >
                {w.distanceKm != null && (
                  <span>{Number(w.distanceKm).toFixed(1)}km</span>
                )}
                {w.distanceKm == null && w.durationMinutes != null && (
                  <span>{w.durationMinutes}min</span>
                )}
                {primaryTarget(w) && (
                  <span style={{ color: T.lime }}>{primaryTarget(w)}</span>
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
