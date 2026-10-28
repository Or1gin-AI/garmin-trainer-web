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
        eyebrow="Training rationale"
        title="Why your week looks like this"
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
          <Metric label="Current level" value={levelZh(capacity.overall.level)} color={T.cyan} />
          <Metric label="Recovery" value={readinessZh(capacity.overall.readiness)} color={readinessColor} />
          <Metric label="Hard sessions cap" value={`${capacity.guardrails.maxHardSessionsPerWeek}/week`} color={T.amber} />
          <Metric
            label="High-intensity time"
            value={capacity.guardrails.maxHighMinutesShare == null ? 'Capped' : `≤${Math.round(capacity.guardrails.maxHighMinutesShare * 100)}%`}
            color={T.lime}
          />
          <Metric
            label="7/28-day load ratio"
            value={capacity.load.acuteChronicRatio === null ? 'Not enough data' : String(capacity.load.acuteChronicRatio)}
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
          <div style={boxTitleStyle}>What the AI adjusted</div>
          <ul style={listStyle}>
            {usefulNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div style={boxStyle}>
          <div style={boxTitleStyle}>Training principles used</div>
          <ul style={listStyle}>
            <li>Recent 7/28/56-day Garmin training load is used to gauge current stress, not just your stated goal.</li>
            <li>Foster monotony and strain flag training that is too repetitive or too concentrated.</li>
            <li>Garmin sleep, HRV, training status and recovery time act as recovery-risk signals; confidence is lowered when data is missing.</li>
            <li>Seiler’s intensity-distribution principles cap threshold, VO2max and anaerobic sessions so extra available time doesn’t turn into extra intensity.</li>
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
    // Backend notes may be Chinese (legacy) or English.
    return /容量|恢复|负荷|高强度|上限|未按原|明确要求|可用时间|同日|多练|强度/.test(note)
      || /capacity|recover|load|intensity|limit|\bcap|as requested|explicit|available time|same day|double/i.test(note);
  });
  if (forceRequestedSchedule) {
    selected.unshift('You asked for the plan to follow your inputs exactly, so requested workouts were kept and risks are shown as warnings only.');
  }
  if (selected.length > 0) return selected.slice(0, 6);
  return ['This week’s plan is based on your recent training volume, recovery status, current fitness in each sport and your goal.'];
}

function isTrainingCapacityView(value: unknown): value is TrainingCapacityView {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<TrainingCapacityView>;
  return Boolean(v.overall && v.load && v.recovery && v.guardrails);
}

function levelZh(level: string): string {
  if (level === 'advanced') return 'Advanced';
  if (level === 'trained') return 'Trained';
  if (level === 'developing') return 'Developing';
  if (level === 'novice') return 'Novice';
  return level || 'Unknown';
}

function readinessZh(readiness: string): string {
  if (readiness === 'green') return 'Good';
  if (readiness === 'yellow') return 'Caution';
  if (readiness === 'red') return 'High risk';
  return readiness || 'Unknown';
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
