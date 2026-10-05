import type { ReactNode } from 'react';
import type { AthleticProfileSport, AthleticSport } from '@/lib/api';
import { Card, CardHeader, StatusBadge, T } from '@/components/track';

interface Props {
  sport: AthleticSport;
  profile: AthleticProfileSport | null;
}

const SPORT_META: Record<AthleticSport, { label: string; code: string; color: string }> = {
  running: { label: 'Running', code: 'RUN', color: T.lime },
  swimming: { label: 'Swimming', code: 'SWIM', color: T.cyan },
  cycling: { label: 'Cycling', code: 'BIKE', color: T.amber },
};

export function SportCard({ sport, profile }: Props) {
  const meta = SPORT_META[sport];

  if (!profile || !profile.available) {
    const count = profile?.activityCountUsed ?? 0;
    return (
      <Card style={{ padding: 22, minHeight: 245 }}>
        <CardHeader
          eyebrow={`SPORT.${meta.code}`}
          title={meta.label}
          right={<StatusBadge kind="planned" size="sm" />}
        />
        <div style={{
          marginTop: 34,
          padding: '28px 0',
          borderTop: `1px dashed ${T.border}`,
          borderBottom: `1px dashed ${T.border}`,
          color: T.inkFaint,
          fontSize: 13,
          lineHeight: 1.7,
        }}>
          Insufficient data. Continue syncing Garmin activities to generate this sport profile.
        </div>
        <div style={{ marginTop: 16, fontFamily: T.mono, fontSize: 10, color: T.inkGhost, letterSpacing: 1.4 }}>
          ACTIVITY.COUNT {count.toLocaleString()} · READ.ONLY
        </div>
      </Card>
    );
  }

  return (
    <Card hot={profile.confidence === 'high'} accent={meta.color} style={{ padding: 22, minHeight: 245 }}>
      <CardHeader
        eyebrow={`SPORT.${meta.code}`}
        title={meta.label}
        right={<ConfidenceBadge confidence={profile.confidence} />}
      />

      <div style={{ marginTop: 18 }}>
        {sport === 'running' && <RunningStats profile={profile} />}
        {sport === 'swimming' && <SwimmingStats profile={profile} />}
        {sport === 'cycling' && <CyclingStats profile={profile} />}
      </div>

      <div style={{
        marginTop: 18,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 12,
        paddingTop: 14,
        borderTop: `1px solid ${T.border}`,
      }}>
        <Fact label="ACT" value={profile.activityCountUsed.toLocaleString()} />
        <Fact label="LAST" value={fmtDate(profile.lastActivityAt)} />
        <Fact label="UPD" value={fmtDate(profile.updatedAt)} />
      </div>
    </Card>
  );
}

function RunningStats({ profile }: { profile: AthleticProfileSport }) {
  const snap = profile.snapshot;
  return (
    <MetricGrid>
      <Metric label="VDOT" value={fmtDecimal(profile.primaryMetric ?? snapshotNumber(snap, 'vdot', 'vo2Max'))} tone={T.lime} />
      <Metric label="Easy pace" value={fmtPaceKm(snapshotNumber(snap, 'easyPaceSecPerKm'))} />
      <Metric label="Long run" value={fmtPaceKm(snapshotNumber(snap, 'longPaceSecPerKm'))} />
      <Metric label="Threshold pace" value={fmtPaceKm(snapshotNumber(snap, 'thresholdPaceSecPerKm'))} />
      <Metric label="VO2 Pace" value={fmtPaceKm(snapshotNumber(snap, 'vo2PaceSecPerKm'))} />
      <Metric label="intervalsPace" value={fmtPaceKm(snapshotNumber(snap, 'intervalPaceSecPerKm'))} />
    </MetricGrid>
  );
}

function SwimmingStats({ profile }: { profile: AthleticProfileSport }) {
  const snap = profile.snapshot;
  return (
    <MetricGrid>
      <Metric label="CSS" value={fmtPace100(profile.primaryMetric ?? snapshotNumber(snap, 'cssSecPer100m', 'cssPaceSecPer100m'))} tone={T.cyan} />
      <Metric label="Easy pace" value={fmtPace100(snapshotNumber(snap, 'easyPaceSecPer100m'))} />
      <Metric label="Endurance pace" value={fmtPace100(snapshotNumber(snap, 'endurancePaceSecPer100m'))} />
      <Metric label="Aerobic pace" value={fmtPace100(snapshotNumber(snap, 'aerobicPaceSecPer100m'))} />
      <Metric label="Threshold pace" value={fmtPace100(snapshotNumber(snap, 'thresholdPaceSecPer100m'))} />
      <Metric label="VO2 Pace" value={fmtPace100(snapshotNumber(snap, 'vo2PaceSecPer100m'))} />
    </MetricGrid>
  );
}

function CyclingStats({ profile }: { profile: AthleticProfileSport }) {
  const snap = profile.snapshot;
  return (
    <MetricGrid>
      <Metric label="FTP" value={fmtWatts(profile.primaryMetric ?? snapshotNumber(snap, 'ftpWatts'))} tone={T.amber} />
      <Metric label="Endurance zone" value={fmtWatts(snapshotNumber(snap, 'enduranceWatts'))} />
      <Metric label="Tempo zone" value={fmtWatts(snapshotNumber(snap, 'tempoWatts'))} />
      <Metric label="Threshold zone" value={fmtWatts(snapshotNumber(snap, 'thresholdWatts'))} />
      <Metric label="VO2max zone" value={fmtWatts(snapshotNumber(snap, 'vo2Watts'))} />
    </MetricGrid>
  );
}

function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
      gap: '13px 14px',
    }}>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  compact,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <div style={{
      minWidth: 0,
      paddingLeft: 10,
      borderLeft: `2px solid ${tone ?? T.borderStrong}`,
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.4, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{
        color: tone ?? T.ink,
        fontFamily: T.mono,
        fontSize: compact ? 12 : 18,
        fontWeight: 600,
        lineHeight: 1.15,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkGhost, letterSpacing: 1.4 }}>{label}</div>
      <div style={{
        marginTop: 4,
        color: T.inkDim,
        fontFamily: T.mono,
        fontSize: 11,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: AthleticProfileSport['confidence'] }) {
  const color = confidence === 'high' ? T.lime : confidence === 'medium' ? T.amber : T.inkFaint;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 8px',
      borderRadius: 4,
      border: `1px solid ${color}45`,
      color,
      fontFamily: T.mono,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      CONF.{confidence}
    </span>
  );
}

function snapshotValue(
  snapshot: AthleticProfileSport['snapshot'],
  ...keys: string[]
): unknown {
  if (!snapshot) return null;
  for (const key of keys) {
    const value = snapshot[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function snapshotNumber(
  snapshot: AthleticProfileSport['snapshot'],
  ...keys: string[]
): number | null {
  const value = snapshotValue(snapshot, ...keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fmtDecimal(value: number | null): string {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fmtWatts(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value)} W`;
}

function fmtPaceKm(sec: number | null): string {
  if (sec == null) return '—';
  return `${fmtPace(sec)}/km`;
}

function fmtPace100(sec: number | null): string {
  if (sec == null) return '—';
  return `${fmtPace(sec)}/100m`;
}

function fmtPace(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value.slice(0, 10) || '—';
  return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
}
