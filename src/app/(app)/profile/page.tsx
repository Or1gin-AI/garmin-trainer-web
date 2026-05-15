'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getAthleticProfile,
  type AthleticProfileResponse,
  type AthleticSport,
  type PerformanceRecord,
} from '@/lib/api';
import { Banner, Btn, PageHero, SectionLabel, StatTile, T } from '@/components/track';
import { ActivityList } from './_components/ActivityList';
import { SportCard } from './_components/SportCard';

const SPORTS: AthleticSport[] = ['running', 'swimming', 'cycling'];

export default function ProfilePage() {
  const [data, setData] = useState<AthleticProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await getAthleticProfile());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sportsById = useMemo(() => {
    const map = new Map<AthleticSport, AthleticProfileResponse['sports'][number]>();
    for (const sport of data?.sports ?? []) map.set(sport.sport, sport);
    return map;
  }, [data]);

  const prsBySport = useMemo(() => {
    const map = new Map<AthleticSport, PerformanceRecord[]>();
    for (const sport of SPORTS) map.set(sport, []);
    for (const record of data?.performanceRecords ?? []) {
      map.get(record.sport)?.push(record);
    }
    for (const records of map.values()) {
      records.sort((a, b) => a.anchor.localeCompare(b.anchor));
    }
    return map;
  }, [data]);

  const availableCount = SPORTS.filter((sport) => sportsById.get(sport)?.available).length;
  const activityCount =
    data?.sports.reduce((sum, sport) => sum + sport.activityCountUsed, 0) ?? 0;
  const latestUpdate = latestDate(data?.sports.map((s) => s.updatedAt) ?? []);
  const latestActivity = latestDate(data?.activities.map((a) => a.startTime) ?? []);

  return (
    <>
      <PageHero
        eyebrow="ATHLETE.PROFILE"
        title="运动能力"
        sub="只读档案：展示后端保存的能力快照、PR 证据和结构化活动指标。"
        actions={
          <Btn variant="ghost" onClick={() => void load()} disabled={loading}>
            <span style={{ fontFamily: T.mono, marginRight: 6 }}>↻</span>
            {loading ? '刷新中…' : '刷新'}
          </Btn>
        }
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="PROFILE.ERR">{error}</Banner>
        </div>
      )}

      {loading && !data && !error && (
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
          // 加载运动能力档案…
        </div>
      )}

      {data && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginBottom: 28,
          }}>
            <StatTile label="可用项目" value={`${availableCount}/3`} unit="SPORT" accent={availableCount > 0 ? T.lime : T.borderStrong} />
            <StatTile label="PR 证据" value={data.performanceRecords.length.toLocaleString()} unit="ROWS" accent={T.cyan} />
            <StatTile label="参与活动" value={activityCount.toLocaleString()} unit="ACT" accent={T.amber} />
            <StatTile label="最近更新" value={latestUpdate.short} unit={latestUpdate.unit} accent={T.lime} />
          </div>

          <SectionLabel right={
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkGhost, letterSpacing: 1.4 }}>
              LAST.ACTIVITY {latestActivity.full}
            </span>
          }>
            SPORT.CAPABILITY
          </SectionLabel>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: 14,
            marginBottom: 28,
          }}>
            {SPORTS.map((sport) => (
              <SportCard
                key={sport}
                sport={sport}
                profile={sportsById.get(sport) ?? null}
                prs={prsBySport.get(sport) ?? []}
              />
            ))}
          </div>

          <SectionLabel>ACTIVITY.INPUTS</SectionLabel>
          <ActivityList activities={data.activities} />
        </>
      )}
    </>
  );
}

function latestDate(values: string[]): { short: string; full: string; unit: string } {
  const dates = values
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  const latest = dates[0];
  if (!latest) return { short: '—', full: '—', unit: '' };

  return {
    short: latest.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
    full: latest.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    unit: 'DATE',
  };
}
