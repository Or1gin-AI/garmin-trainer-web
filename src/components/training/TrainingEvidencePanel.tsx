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
        title="Why this plan is structured this way"
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
          <Metric label="Current ability" value={levelZh(capacity.overall.level)} color={T.cyan} />
          <Metric label="RecoveryStatus" value={readinessZh(capacity.overall.readiness)} color={readinessColor} />
          <Metric label="High intensitylimit" value={`${capacity.guardrails.maxHardSessionsPerWeek} sessions/week`} color={T.amber} />
          <Metric
            label="intensityminutes"
            value={capacity.guardrails.maxHighMinutesShare == null ? 'Controlled' : `≤${Math.round(capacity.guardrails.maxHighMinutesShare * 100)}%`}
            color={T.lime}
          />
          <Metric
            label="7/28 load ratio"
            value={capacity.load.acuteChronicRatio === null ? 'insufficient' : String(capacity.load.acuteChronicRatio)}
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
          <div style={boxTitleStyle}>What the system actually did</div>
          <ul style={listStyle}>
            {usefulNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div style={boxStyle}>
          <div style={boxTitleStyle}>Sources of training rules</div>
          <ul style={listStyle}>
            <li>Use recent 7/28/56-day CN Garmin training load to assess current stress, rather than relying only on the user’s goal.</li>
            <li>Use Foster monotony and strain to check whether training is repetitive or overly stressful.</li>
            <li>Use Garmin sleep, HRV, training status, and recovery time as recovery-risk signals; reduce confidence when data is missing.</li>
            <li>Follow Seiler intensity-distribution principles, limit threshold and VO2max sessions, and avoid turning all available time into high intensity.</li>
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
    return /|Recovery|Load|High intensity|limit||need|Available time|day|Double days|intensity/.test(note);
  });
  if (forceRequestedSchedule) {
    selected.unshift('The user explicitly requested generation as entered; keep risk warnings without automatically deleting requested training.');
  }
  if (selected.length > 0) return selected.slice(0, 6);
  return ['This week’s plan was generated from recent training volume, recovery status, sport ability, and the user’s goal.'];
}

function isTrainingCapacityView(value: unknown): value is TrainingCapacityView {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<TrainingCapacityView>;
  return Boolean(v.overall && v.load && v.recovery && v.guardrails);
}

function levelZh(level: string): string {
  if (level === 'advanced') return 'Advanced';
  if (level === 'trained') return 'Stable';
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
