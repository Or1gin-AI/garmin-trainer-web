'use client';

import { useState } from 'react';
import { SPORT_LABELS, type TrainingWorkout } from '@/lib/api';
import {
  T, Btn, Card, StatusBadge, IntensityMeter, SportTag, WorkoutCodename,
  type StatusKind, type IntensityKind, type SportKind,
} from '@/components/track';

const STATUS_MAP: Record<TrainingWorkout['status'], StatusKind> = {
  planned: 'planned',
  completed: 'completed',
  skipped: 'skipped',
  regenerating: 'regenerating',
};

function formatDate(d: string): { dd: string; mm: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return { dd: '', mm: d };
  return { dd: m[3], mm: `${Number(m[2])}/${Number(m[3])}` };
}

function primaryTarget(w: TrainingWorkout): { label: string; value: string } | null {
  const pickHR = () => (w.targetHeartRate && w.targetHeartRate !== '不适用' ? { label: 'HR', value: w.targetHeartRate } : null);
  const pickPace = () => (w.targetPace && w.targetPace !== '不适用' ? { label: 'PACE', value: w.targetPace } : null);
  const pickPower = () => (w.targetPower && w.targetPower !== '不适用' ? { label: 'PWR', value: w.targetPower } : null);
  switch (w.targetMetric) {
    case 'heart_rate': return pickHR();
    case 'pace': return pickPace();
    case 'power': return pickPower();
    case 'mixed': return pickHR() ?? pickPace() ?? pickPower();
    default: return null;
  }
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
  const [open, setOpen] = useState(false);
  const target = primaryTarget(w);
  const isRest = w.sport === 'rest';
  const intensityKind: IntensityKind = isRest ? 'rest' : (w.intensity ?? 'low');
  const sportKind = w.sport as SportKind;
  const { dd, mm } = formatDate(w.date);

  const accent = highlighted ? T.amber : (w.status === 'regenerating' ? T.cyan : null);

  return (
    <Card
      hot={highlighted}
      glow={highlighted}
      style={{ padding: 0, overflow: 'hidden', opacity: busy ? 0.7 : 1, transition: 'opacity .15s' }}
      accent={accent}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '60px minmax(0, 1fr) auto', alignItems: 'center', padding: '14px 18px', gap: 16 }}>
        <div style={{ textAlign: 'center', borderRight: `1px solid ${T.border}`, paddingRight: 16 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5 }}>DAY</div>
          <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: highlighted ? T.lime : T.ink, letterSpacing: -1, lineHeight: 1 }}>
            {String(w.dayIndex).padStart(2, '0')}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, marginTop: 4, letterSpacing: 1 }}>{mm || dd}</div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <SportTag kind={sportKind} />
            {!isRest && w.intensity && <IntensityMeter kind={intensityKind} label={false} />}
            <StatusBadge kind={STATUS_MAP[w.status]} size="sm" />
          </div>
          <WorkoutCodename
            code={w.templateId || w.workoutType || w.title || '—'}
            name={w.title}
            size="sm"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {!isRest && (
            <div style={{ display: 'flex', gap: 14, fontFamily: T.mono, fontSize: 12, color: T.ink }}>
              {w.durationMinutes != null && (
                <span>{w.durationMinutes}<span style={{ color: T.inkFaint, marginLeft: 2 }}>min</span></span>
              )}
              {w.distanceKm != null && (
                <span>{Number(w.distanceKm).toFixed(1)}<span style={{ color: T.inkFaint, marginLeft: 2 }}>km</span></span>
              )}
            </div>
          )}
          {target && (
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 0.5 }}>
              {target.label} {target.value}
            </div>
          )}
        </div>
      </div>

      {open && !isRest && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.border}` }}>
          {w.workoutStructure && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>STRUCTURE</div>
              <div style={{
                fontFamily: T.mono, fontSize: 12, color: T.ink, lineHeight: 1.7,
                background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, border: `1px solid ${T.border}`,
                whiteSpace: 'pre-line',
              }}>{w.workoutStructure}</div>
            </div>
          )}
          {(w.targets ?? []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>KEY.TARGETS</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: T.ink }}>
                {(w.targets ?? []).map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ color: T.lime, fontFamily: T.mono, fontSize: 10 }}>›</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {w.adaptation && (
            <div style={{
              marginTop: 14, padding: 12, background: T.cyanSoft, border: `1px solid ${T.cyan}30`,
              borderRadius: 6, fontSize: 12, color: T.ink, lineHeight: 1.6,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan, letterSpacing: 1.5, marginRight: 8 }}>ADAPT</span>
              {w.adaptation}
            </div>
          )}
          {!w.workoutStructure && (w.targets ?? []).length === 0 && !w.adaptation && (
            <div style={{ marginTop: 14, fontFamily: T.mono, fontSize: 11, color: T.inkFaint }}>
              // 无更多细节
            </div>
          )}
        </div>
      )}

      {!isRest && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 18px',
          borderTop: `1px solid ${T.border}`, background: 'rgba(0,0,0,0.15)',
          alignItems: 'center',
        }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              background: 'transparent', border: 'none', color: T.inkDim, cursor: 'pointer',
              fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2, padding: 0,
            }}
          >{open ? '▴ COLLAPSE' : '▾ EXPAND'}</button>
          <span style={{ flex: 1, fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.2, marginLeft: 8 }}>
            {SPORT_LABELS[w.sport]}
          </span>
          <Btn variant="ok" size="sm" onClick={onComplete} disabled={busy || w.status === 'completed'}>
            {w.status === 'completed' ? '✓ DONE' : '完成'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onSkip} disabled={busy || w.status === 'skipped'}>
            {w.status === 'skipped' ? '— SKIPPED' : '跳过'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onRegenerate} disabled={busy}>↻ 重生成</Btn>
        </div>
      )}

      {isRest && (
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1.2 }}>
          // REST.DAY · 主动恢复 / 拉伸即可
        </div>
      )}
    </Card>
  );
}
