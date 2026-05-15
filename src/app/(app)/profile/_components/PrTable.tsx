import type { AthleticSport, PerformanceRecord } from '@/lib/api';
import { T } from '@/components/track';

interface Props {
  prs: PerformanceRecord[];
  sport: AthleticSport;
}

export function PrTable({ prs, sport }: Props) {
  if (prs.length === 0) {
    return (
      <p style={{ margin: '12px 0 0', color: T.inkFaint, fontSize: 13 }}>
        暂无可用 PR 证据。
      </p>
    );
  }

  return (
    <div style={{ marginTop: 12, overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        minWidth: 480,
        borderCollapse: 'collapse',
        fontSize: 13,
      }}>
        <thead>
          <tr style={{ color: T.inkFaint, textAlign: 'left', fontFamily: T.mono, fontSize: 10, letterSpacing: 1.2 }}>
            <th style={{ padding: '0 12px 8px 0', fontWeight: 500 }}>ANCHOR</th>
            <th style={{ padding: '0 12px 8px 0', fontWeight: 500 }}>BEST</th>
            <th style={{ padding: '0 12px 8px 0', fontWeight: 500 }}>CONF</th>
            <th style={{ padding: '0 0 8px', fontWeight: 500 }}>DATE</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((r) => (
            <tr key={`${r.anchor}:${r.achievedAt}:${r.sourceRegion ?? ''}:${r.sourceActivityId ?? ''}`} className="track-row">
              <td style={{ padding: '9px 12px 9px 0', borderTop: `1px solid ${T.border}`, color: T.ink }}>
                {labelAnchor(r.anchor, sport)}
                {r.isUserEntered && (
                  <span style={{ marginLeft: 8, color: T.amber, fontFamily: T.mono, fontSize: 10 }}>MANUAL</span>
                )}
              </td>
              <td style={{
                padding: '9px 12px 9px 0',
                borderTop: `1px solid ${T.border}`,
                color: T.lime,
                fontFamily: T.mono,
                whiteSpace: 'nowrap',
              }}>
                {fmtValue(r.bestValue, r.bestUnit)}
              </td>
              <td style={{
                padding: '9px 12px 9px 0',
                borderTop: `1px solid ${T.border}`,
                color: confidenceColor(r.confidence),
                fontFamily: T.mono,
                fontSize: 11,
                textTransform: 'uppercase',
              }}>
                {r.confidence}
              </td>
              <td style={{
                padding: '9px 0',
                borderTop: `1px solid ${T.border}`,
                color: T.inkDim,
                fontFamily: T.mono,
                whiteSpace: 'nowrap',
              }}>
                {fmtDate(r.achievedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function labelAnchor(anchor: string, sport: AthleticSport): string {
  const raw = anchor.replace(/^(run|swim|bike):/, '');
  const key = raw.toLowerCase();
  const known: Record<string, string> = {
    '1k': '1 km',
    '3k': '3 km',
    '5k': '5 km',
    '10k': '10 km',
    hm: 'Half marathon',
    fm: 'Marathon',
    half_marathon: 'Half marathon',
    marathon: 'Marathon',
    '100m': '100 m',
    '200m': '200 m',
    '400m': '400 m',
    '800m': '800 m',
    '1500m': '1500 m',
    '20min': '20 min power',
    '60min': '60 min power',
    '20min_power': '20 min power',
    '60min_power': '60 min power',
  };
  return known[key] ?? `${sport.toUpperCase()} ${raw}`;
}

function fmtValue(value: number, unit: 'seconds' | 'watts'): string {
  if (unit === 'watts') return `${Math.round(value)} W`;
  return fmtDurationSeconds(value);
}

function fmtDurationSeconds(value: number): string {
  const total = Math.max(0, Math.round(value));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value.slice(0, 10) || '—';
  return parsed.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function confidenceColor(confidence: PerformanceRecord['confidence']): string {
  if (confidence === 'high') return T.lime;
  if (confidence === 'medium') return T.amber;
  return T.inkFaint;
}
