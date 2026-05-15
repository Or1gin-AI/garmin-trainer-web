'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AthleticProfileResponse, ProfileActivity } from '@/lib/api';
import { Btn, Card, CardHeader, T } from '@/components/track';

const PAGE_SIZE = 20;

const SPORT_LABEL: Record<ProfileActivity['sport'], string> = {
  running: '跑步',
  swimming: '游泳',
  cycling: '骑行',
  other: '其他',
};

export function ActivityList({
  activities,
}: {
  activities: AthleticProfileResponse['activities'];
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [activities]);

  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => activities.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [activities, safePage],
  );

  if (activities.length === 0) {
    return (
      <Card style={{ padding: 22 }}>
        <CardHeader eyebrow="ACTIVITY.METRICS" title="参与计算的活动" />
        <p style={{ margin: '16px 0 0', color: T.inkDim, fontSize: 13 }}>
          还没有结构化活动数据。
        </p>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 22 }}>
      <CardHeader
        eyebrow="ACTIVITY.METRICS"
        title="参与计算的活动"
        right={
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1.2 }}>
            {safePage + 1}/{pageCount} · {activities.length} ACT
          </span>
        }
      />

      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          minWidth: 780,
          borderCollapse: 'collapse',
          fontSize: 13,
        }}>
          <thead>
            <tr style={{ color: T.inkFaint, textAlign: 'left', fontFamily: T.mono, fontSize: 10, letterSpacing: 1.2 }}>
              <th style={thStyle}>DATE</th>
              <th style={thStyle}>SPORT</th>
              <th style={thStyle}>REGION</th>
              <th style={thStyle}>DIST</th>
              <th style={thStyle}>TIME</th>
              <th style={thStyle}>AVG</th>
              <th style={thStyle}>HR</th>
              <th style={thStyleLast}>QUALITY</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr
                key={`${a.region}:${a.activityId}:${a.startTime}`}
                className="track-row"
                style={{ opacity: a.excluded ? 0.45 : 1 }}
              >
                <td style={tdMono}>{fmtDate(a.startTime)}</td>
                <td style={tdStyle}>
                  <span style={{ color: sportColor(a.sport), fontWeight: 600 }}>{SPORT_LABEL[a.sport] ?? a.sport}</span>
                  {a.excluded && (
                    <span style={{ marginLeft: 8, color: T.amber, fontFamily: T.mono, fontSize: 10 }}>EXCL</span>
                  )}
                </td>
                <td style={tdMono}>{String(a.region).toUpperCase()}</td>
                <td style={tdMono}>{fmtDistance(a.distanceKm)}</td>
                <td style={tdMono}>{fmtDuration(a.durationMin)}</td>
                <td style={tdMono}>{fmtAverage(a)}</td>
                <td style={tdMono}>{a.avgHr ?? '—'}</td>
                <td style={tdMonoLast}>
                  <span style={{ color: confidenceColor(a.qualityConfidence), textTransform: 'uppercase' }}>
                    {a.qualityConfidence}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkGhost, letterSpacing: 1.4 }}>
          SHOWING {visible.length} OF {activities.length}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn
            variant="ghost"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="上一页"
          >
            ‹
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="下一页"
          >
            ›
          </Btn>
        </div>
      </div>
    </Card>
  );
}

const thStyle = {
  padding: '0 12px 8px 0',
  fontWeight: 500,
} as const;

const thStyleLast = {
  padding: '0 0 8px',
  fontWeight: 500,
} as const;

const tdStyle = {
  padding: '10px 12px 10px 0',
  borderTop: `1px solid ${T.border}`,
  color: T.ink,
  whiteSpace: 'nowrap',
} as const;

const tdMono = {
  ...tdStyle,
  color: T.inkDim,
  fontFamily: T.mono,
} as const;

const tdMonoLast = {
  padding: '10px 0',
  borderTop: `1px solid ${T.border}`,
  color: T.inkDim,
  fontFamily: T.mono,
  whiteSpace: 'nowrap',
} as const;

function fmtDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value.slice(0, 10) || '—';
  return parsed.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDistance(km: number | null): string {
  if (km == null) return '—';
  return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
}

function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

function fmtAverage(activity: ProfileActivity): string {
  if (activity.sport === 'swimming' && activity.avgPaceSecPer100m != null) {
    return `${fmtPace(activity.avgPaceSecPer100m)}/100m`;
  }
  if (activity.sport === 'cycling' && activity.avgPower != null) {
    return `${Math.round(activity.avgPower)} W`;
  }
  if (activity.avgPaceSecPerKm != null) {
    return `${fmtPace(activity.avgPaceSecPerKm)}/km`;
  }
  return '—';
}

function fmtPace(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sportColor(sport: ProfileActivity['sport']): string {
  if (sport === 'running') return T.lime;
  if (sport === 'cycling') return T.amber;
  if (sport === 'swimming') return T.cyan;
  return T.inkDim;
}

function confidenceColor(confidence: ProfileActivity['qualityConfidence']): string {
  if (confidence === 'high') return T.lime;
  if (confidence === 'medium') return T.amber;
  return T.inkFaint;
}
