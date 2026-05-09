'use client';

import { useState } from 'react';
import { SPORT_LABELS, type TrainingWorkout } from '@/lib/api';

const STATUS_CLASS: Record<TrainingWorkout['status'], string> = {
  planned: 'bg-zinc-100 text-zinc-700',
  completed: 'bg-emerald-100 text-emerald-700',
  skipped: 'bg-amber-100 text-amber-700',
  regenerating: 'bg-blue-100 text-blue-700',
};

const STATUS_LABEL: Record<TrainingWorkout['status'], string> = {
  planned: '已计划',
  completed: '已完成',
  skipped: '已跳过',
  regenerating: '生成中…',
};

const INTENSITY_LABEL: Record<NonNullable<TrainingWorkout['intensity']>, string> = {
  low: '低强度',
  medium: '中等',
  high: '高强度',
};

const INTENSITY_CLASS: Record<NonNullable<TrainingWorkout['intensity']>, string> = {
  low: 'text-emerald-600',
  medium: 'text-amber-600',
  high: 'text-red-600',
};

function formatDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${Number(m[2])}月${Number(m[3])}日`;
}

function primaryTarget(w: TrainingWorkout): { label: string; value: string } | null {
  switch (w.targetMetric) {
    case 'heart_rate':
      return { label: '目标心率', value: w.targetHeartRate };
    case 'pace':
      return { label: '目标配速', value: w.targetPace };
    case 'power':
      return { label: '目标功率', value: w.targetPower };
    case 'mixed':
      // Show whichever isn't 不适用 first.
      if (w.targetHeartRate && w.targetHeartRate !== '不适用') {
        return { label: '目标心率', value: w.targetHeartRate };
      }
      if (w.targetPace && w.targetPace !== '不适用') {
        return { label: '目标配速', value: w.targetPace };
      }
      return null;
    case 'none':
    default:
      return null;
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

  const statusKey: TrainingWorkout['status'] = w.status;
  const intensityKey = w.intensity ?? null;

  return (
    <article
      className={
        'bg-white border rounded-2xl p-4 flex flex-col gap-3 transition-shadow ' +
        (highlighted
          ? 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]'
          : 'border-zinc-200')
      }
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-zinc-500">
            第 {w.dayIndex} 天 · {formatDate(w.date)}
          </div>
          <h3 className="text-base font-semibold mt-0.5">{w.title || '—'}</h3>
        </div>
        <span
          className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${STATUS_CLASS[statusKey]}`}
        >
          {STATUS_LABEL[statusKey]}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-zinc-700">{SPORT_LABELS[w.sport]}</span>
        {intensityKey && (
          <span className={INTENSITY_CLASS[intensityKey]}>
            {INTENSITY_LABEL[intensityKey]}
          </span>
        )}
        {w.durationMinutes !== null && (
          <span className="text-zinc-500">{w.durationMinutes} 分钟</span>
        )}
        {w.distanceKm !== null && (
          <span className="text-zinc-500">
            {Number(w.distanceKm).toFixed(1)} km
          </span>
        )}
      </div>

      {target && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm">
          <span className="text-emerald-700 text-xs uppercase tracking-wider mr-2">
            {target.label}
          </span>
          <span className="font-medium text-emerald-900">{target.value}</span>
        </div>
      )}

      {(w.workoutStructure || (w.targets ?? []).length > 0 || w.adaptation) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-zinc-500 hover:text-zinc-800 self-start"
        >
          {open ? '收起 ▴' : '查看详情 ▾'}
        </button>
      )}

      {open && (
        <div className="space-y-2 text-sm">
          {w.workoutStructure && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">训练结构</div>
              <p className="text-zinc-800 whitespace-pre-line leading-relaxed">
                {w.workoutStructure}
              </p>
            </div>
          )}
          {(w.targets ?? []).length > 0 && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">关键指标</div>
              <ul className="list-disc list-inside text-zinc-800 space-y-0.5">
                {(w.targets ?? []).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {w.adaptation && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">适应性说明</div>
              <p className="text-zinc-700 leading-relaxed">{w.adaptation}</p>
            </div>
          )}
        </div>
      )}

      <footer className="flex flex-wrap gap-2 pt-1 border-t border-zinc-100">
        <button
          type="button"
          onClick={onComplete}
          disabled={busy || w.status === 'completed'}
          className="px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {w.status === 'completed' ? '已完成' : '完成'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy || w.status === 'skipped'}
          className="px-2.5 py-1 rounded-md text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {w.status === 'skipped' ? '已跳过' : '跳过'}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className="ml-auto px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
        >
          重新生成此天
        </button>
      </footer>
    </article>
  );
}
