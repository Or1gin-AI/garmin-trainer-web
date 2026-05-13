'use client';

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

function usable(value: string | null | undefined): string | null {
  return value && value !== '不适用' ? value : null;
}

function allTargets(w: TrainingWorkout): Array<{ label: string; value: string; primary?: boolean }> {
  const rows: Array<{ label: string; value: string; primary?: boolean }> = [];
  const metricLabel: Record<string, string> = {
    heart_rate: '主指标 心率',
    pace: '主指标 配速',
    power: '主指标 功率',
    mixed: '主指标 混合',
    none: '主指标 无',
  };
  rows.push({ label: '目标模式', value: metricLabel[w.targetMetric] ?? w.targetMetric, primary: true });
  const hr = usable(w.targetHeartRate);
  const pace = usable(w.targetPace);
  const power = usable(w.targetPower);
  if (hr) rows.push({ label: '心率', value: hr, primary: w.targetMetric === 'heart_rate' });
  if (pace) rows.push({ label: '配速', value: pace, primary: w.targetMetric === 'pace' });
  if (power) rows.push({ label: '功率', value: power, primary: w.targetMetric === 'power' });
  return rows;
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
  const targets = allTargets(w);
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
      <div style={{ display: 'grid', gridTemplateColumns: '60px minmax(0, 1fr)', alignItems: 'center', padding: '14px 18px', gap: 16 }}>
        <div style={{ textAlign: 'center', borderRight: `1px solid ${T.border}`, paddingRight: 16 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5 }}>第</div>
          <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: highlighted ? T.lime : T.ink, letterSpacing: -1, lineHeight: 1 }}>
            {w.dayIndex}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, marginTop: 4, letterSpacing: 1 }}>天 · {mm || dd}</div>
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
          {w.sessionLabel && (
            <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 10, color: T.amber, letterSpacing: 1.2 }}>
              {w.sessionLabel}{w.timeOfDay ? ` · ${w.timeOfDay}` : ''}
            </div>
          )}
        </div>
      </div>

      {!isRest && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.border}` }}>
          <div style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 8,
          }}>
            {w.durationMinutes != null && <DataChip label="总时长" value={`${w.durationMinutes} 分钟`} />}
            {w.distanceKm != null && <DataChip label="距离" value={`${Number(w.distanceKm).toFixed(1)} 公里`} />}
            {w.workoutType && <DataChip label="类型" value={w.workoutType} />}
            {w.intensity && <DataChip label="强度" value={w.intensity} />}
            {targets.map((item) => (
              <DataChip
                key={`${item.label}-${item.value}`}
                label={item.label}
                value={item.value}
                hot={item.primary}
              />
            ))}
          </div>

          {w.workoutStructure && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>训练结构</div>
              <div style={{
                fontFamily: T.mono, fontSize: 12, color: T.ink, lineHeight: 1.7,
                background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, border: `1px solid ${T.border}`,
                whiteSpace: 'pre-line',
              }}>{w.workoutStructure}</div>
            </div>
          )}
          {(w.targets ?? []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>关键要点</div>
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
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan, letterSpacing: 1.5, marginRight: 8 }}>适应</span>
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
          <span style={{ flex: 1, fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.2 }}>
            {SPORT_LABELS[w.sport]}
          </span>
          <Btn variant="ok" size="sm" onClick={onComplete} disabled={busy || w.status === 'completed'}>
            {w.status === 'completed' ? '✓ 已完成' : '完成'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onSkip} disabled={busy || w.status === 'skipped'}>
            {w.status === 'skipped' ? '— 已跳过' : '跳过'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onRegenerate} disabled={busy}>↻ 重新生成</Btn>
        </div>
      )}

      {isRest && (
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1.2 }}>
          // 休息日 · 主动恢复 / 拉伸即可
        </div>
      )}
    </Card>
  );
}

function DataChip({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div style={{
      minWidth: 0,
      padding: '8px 10px',
      border: `1px solid ${hot ? T.lime : T.border}`,
      borderRadius: 6,
      background: hot ? T.limeGlow : 'rgba(0,0,0,0.22)',
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: hot ? T.lime : T.inkFaint, letterSpacing: 1.2, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, lineHeight: 1.35, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}
