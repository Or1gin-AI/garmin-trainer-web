'use client';

import { T, Card, CardHeader } from '@/components/track';
import type { TrainingCapacityView } from '@/lib/api';

type SnapshotLike = {
  trainingCapacity?: unknown;
  scheduleNotes?: unknown;
  forceRequestedSchedule?: unknown;
};

export function readTrainingEvidenceSnapshot(value: unknown): {
  capacity: TrainingCapacityView | null;
  scheduleNotes: string[];
  forceRequestedSchedule: boolean;
} {
  if (!value || typeof value !== 'object') {
    return { capacity: null, scheduleNotes: [], forceRequestedSchedule: false };
  }
  const snapshot = value as SnapshotLike;
  return {
    capacity: isTrainingCapacityView(snapshot.trainingCapacity) ? snapshot.trainingCapacity : null,
    scheduleNotes: Array.isArray(snapshot.scheduleNotes)
      ? snapshot.scheduleNotes.filter((n): n is string => typeof n === 'string')
      : [],
    forceRequestedSchedule: snapshot.forceRequestedSchedule === true,
  };
}

export function TrainingEvidencePanel({
  capacity,
  scheduleNotes = [],
  forceRequestedSchedule = false,
}: {
  capacity: TrainingCapacityView | null;
  scheduleNotes?: string[];
  forceRequestedSchedule?: boolean;
}) {
  if (!capacity && scheduleNotes.length === 0) return null;

  const readiness = capacity?.overall.readiness ?? 'unknown';
  const readinessColor =
    readiness === 'red' ? T.red : readiness === 'yellow' ? T.amber : T.lime;
  const usefulNotes = selectDecisionNotes(capacity, scheduleNotes, forceRequestedSchedule);

  return (
    <Card style={{ padding: 22 }}>
      <CardHeader
        eyebrow="// 专业生成依据"
        title="这次课表为什么这样排"
        right={
          <span style={{ fontFamily: T.mono, fontSize: 10, color: readinessColor, letterSpacing: 1.2 }}>
            ● READINESS.{String(readiness).toUpperCase()}
          </span>
        }
      />

      {capacity && (
        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          <Metric label="当前能力" value={levelZh(capacity.overall.level)} color={T.cyan} />
          <Metric label="恢复状态" value={readinessZh(capacity.overall.readiness)} color={readinessColor} />
          <Metric label="高强度上限" value={`${capacity.guardrails.maxHardSessionsPerWeek} 次/周`} color={T.amber} />
          <Metric
            label="强度分钟"
            value={capacity.guardrails.maxHighMinutesShare == null ? '受控' : `≤${Math.round(capacity.guardrails.maxHighMinutesShare * 100)}%`}
            color={T.lime}
          />
          <Metric
            label="7/28负荷比"
            value={capacity.load.acuteChronicRatio === null ? '不足' : String(capacity.load.acuteChronicRatio)}
            color={T.cyan}
          />
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        <div style={boxStyle}>
          <div style={boxTitleStyle}>系统实际做了什么</div>
          <ul style={listStyle}>
            {usefulNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div style={boxStyle}>
          <div style={boxTitleStyle}>专业规则来源</div>
          <ul style={listStyle}>
            <li>用最近 7/28/56 天 Garmin 训练负荷判断近期压力，而不是只看用户填写的目标。</li>
            <li>用 Foster monotony/strain 检查训练是否过于单调或压力集中。</li>
            <li>用 Garmin 睡眠、HRV、训练状态、恢复时间作为恢复风险信号；缺失时降低置信度。</li>
            <li>参考 Seiler 强度分布原则，限制阈值、VO2、无氧课数量，避免把长可用时间堆成高强度。</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '10px 12px',
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.2 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontFamily: T.mono, fontSize: 16, color, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

function selectDecisionNotes(
  capacity: TrainingCapacityView | null,
  scheduleNotes: string[],
  forceRequestedSchedule: boolean,
): string[] {
  const notes = [
    ...(capacity?.guardrails.notes ?? []),
    ...scheduleNotes,
  ].filter(Boolean);
  const selected = notes.filter((note, index, arr) => {
    if (arr.indexOf(note) !== index) return false;
    return /容量|恢复|高强度|上限|未按原|明确要求|可用时间|同日|多练|强度/.test(note);
  });
  if (forceRequestedSchedule) {
    selected.unshift('用户已明确要求按原请求生成；系统保留风险提示，但不自动删除用户坚持要求的训练。');
  }
  if (selected.length > 0) return selected.slice(0, 6);
  return ['本周课表已按近期训练量、恢复状态、项目能力和用户目标共同生成。'];
}

function isTrainingCapacityView(value: unknown): value is TrainingCapacityView {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<TrainingCapacityView>;
  return Boolean(v.overall && v.load && v.recovery && v.guardrails);
}

function levelZh(level: string): string {
  if (level === 'advanced') return '高级';
  if (level === 'trained') return '稳定';
  if (level === 'developing') return '发展中';
  if (level === 'novice') return '新手';
  return level || '未知';
}

function readinessZh(readiness: string): string {
  if (readiness === 'green') return '良好';
  if (readiness === 'yellow') return '谨慎';
  if (readiness === 'red') return '高风险';
  return readiness || '未知';
}

const boxStyle = {
  padding: 14,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.22)',
} as const;

const boxTitleStyle = {
  fontFamily: T.mono,
  fontSize: 10,
  color: T.cyan,
  letterSpacing: 1.4,
  marginBottom: 8,
} as const;

const listStyle = {
  margin: 0,
  paddingLeft: 18,
  color: T.ink,
  fontSize: 13,
  lineHeight: 1.65,
} as const;
