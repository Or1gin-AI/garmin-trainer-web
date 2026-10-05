'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type SyncJob, type MeResponse, type GarminAccountSummary } from '@/lib/api';
import {
  T, Btn, Card, CardHeader, StatTile, SectionLabel, StatusBadge, PageHero, Banner,
  type StatusKind,
} from '@/components/track';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US');
}

function fmtTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function elapsed(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return '—';
  const sec = Math.floor((e - s) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const STATUS_MAP: Record<SyncJob['status'], StatusKind> = {
  queued: 'queued',
  running: 'running',
  success: 'success',
  failed: 'failed',
  aborted: 'aborted',
};

function planStatus(plan: MeResponse['plan'] | null) {
  if (!plan || plan.plan === 'free') return 'FREE · MANUAL';
  return `${plan.plan.toUpperCase()} · ${plan.canAutoSync ? 'AUTO ON' : 'MANUAL'}`;
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [accounts, setAccounts] = useState<GarminAccountSummary[]>([]);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [current, setCurrent] = useState<SyncJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    const [meRes, accRes, jobsRes, currentRes] = await Promise.all([
      api.get<MeResponse>('/api/me'),
      api.get<{ accounts: GarminAccountSummary[] }>('/api/garmin/accounts'),
      api.get<{ jobs: SyncJob[] }>('/api/sync/jobs'),
      api.get<{ job: SyncJob | null }>('/api/sync/jobs/current/status'),
    ]);
    setMe(meRes);
    setAccounts(accRes.accounts);
    setJobs(jobsRes.jobs);
    setCurrent(currentRes.job);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    const isActive =
      current && (current.status === 'queued' || current.status === 'running');
    if (isActive) {
      pollRef.current = setInterval(() => {
        refresh().catch(() => {});
      }, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [current?.status]);

  async function triggerSync() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/sync/jobs', { mode: 'incremental' });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cnAcc = accounts.find((a) => a.region === 'cn');
  const intlAcc = accounts.find((a) => a.region === 'global');
  const cnReady = cnAcc?.hasSession ?? false;
  const globalReady = intlAcc?.hasSession ?? false;
  const ready = cnReady && globalReady;
  const completedJobs = jobs.filter((j) => j.status === 'success');
  const totalUploaded = completedJobs.reduce((s, j) => s + (j.result?.uploaded ?? 0), 0);

  const progress = current?.progress;
  const percent = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)));
  const recentLogs = (progress?.logs ?? []).slice(-4).reverse();

  return (
    <>
      <PageHero
        eyebrow="SYNC.CONSOLE"
        title="Sync console"
        sub={
          me?.plan.canAutoSync
            ? <>Plus users get incremental sync every 2 hours; Max also unlocks AI training plans and coach chat.</>
            : <>Garmin sync is a Plus feature. Upgrade to Plus to trigger sync manually and enable automatic sync; upgrade to Max to unlock AI.</>
        }
        actions={
          <>
            <Btn variant="ghost" onClick={() => refresh().catch(() => {})}>
              <span style={{ fontFamily: T.mono, marginRight: 6 }}>↻</span>Refresh
            </Btn>
            <Btn onClick={triggerSync} disabled={busy || !ready || !me?.plan.canAutoSync}>
              {busy ? 'Triggering…' : 'Trigger sync →'}
            </Btn>
          </>
        }
      />

      {!ready && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="warn" code="ACCT.MISSING">
            Sign in and verify both CN and International Garmin accounts on the Garmin Accounts page before syncing.
            <Link href="/garmin" className="track-link" style={{ marginLeft: 8 }}>Go to Configuration →</Link>
          </Banner>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatTile
          label="CNsession"
          value={cnReady ? 'OK' : '—'}
          unit="CN"
          delta={cnAcc?.lastValidatedAt ? new Date(cnAcc.lastValidatedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : null}
          tone={cnReady ? 'ok' : undefined}
          accent={cnReady ? T.lime : T.border}
          mono={false}
        />
        <StatTile
          label="Internationalsession"
          value={globalReady ? 'OK' : '—'}
          unit="INTL"
          delta={intlAcc?.lastValidatedAt ? new Date(intlAcc.lastValidatedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : null}
          tone={globalReady ? 'ok' : undefined}
          accent={globalReady ? T.lime : T.border}
          mono={false}
        />
        <StatTile
          label="Total uploaded"
          value={totalUploaded.toLocaleString()}
          unit="ACT"
          accent={T.cyan}
        />
        <StatTile
          label="Latest automatic"
          value={me?.plan.lastAutoSyncAt
            ? new Date(me.plan.lastAutoSyncAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : '—'}
          unit={me?.plan.lastAutoSyncAt ? 'TIME' : ''}
          delta={me?.plan.canAutoSync ? 'AUTO' : 'OFF'}
          tone={me?.plan.canAutoSync ? 'ok' : 'warn'}
          accent={T.cyan}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14, marginBottom: 28 }}>
        {current && (current.status === 'queued' || current.status === 'running') ? (
          <Card hot glow style={{ padding: 22 }}>
            <CardHeader
              eyebrow="ACTIVE.JOB"
              title={`JOB.${current.id.slice(0, 8).toUpperCase()} · ${current.status === 'queued' ? 'Queued' : 'Sync'}`}
              right={<StatusBadge kind={STATUS_MAP[current.status]} />}
            />
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
              {[
                ['MODE', current.mode === 'history' ? 'Historical backfill' : 'Sync'],
                ['TRIGGER', current.trigger === 'cron' ? 'AUTO' : 'MANUAL'],
                ['STARTED', fmtTime(current.startedAt ?? current.queuedAt)],
                ['ELAPSED', elapsed(current.startedAt ?? current.queuedAt, null)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5 }}>{k}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 14, color: T.ink, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 11, color: T.inkDim, marginBottom: 8 }}>
                <span>
                  UP <span style={{ color: T.lime }}>{progress?.uploaded ?? 0}</span>
                  {' '}· SKIP {progress?.skipped ?? 0}
                  {' '}· FAIL <span style={{ color: (progress?.failed ?? 0) > 0 ? T.red : T.inkFaint }}>{progress?.failed ?? 0}</span>
                </span>
                <span style={{ color: T.lime }}>{percent}%</span>
              </div>
              <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
                <div
                  className={current.status === 'running' ? 'track-blink' : ''}
                  style={{ width: `${percent}%`, height: '100%', background: T.lime, boxShadow: `0 0 12px ${T.lime}`, transition: 'width .25s' }}
                />
              </div>
              {(progress?.message || recentLogs.length > 0) && (
                <div style={{
                  marginTop: 14, fontFamily: T.mono, fontSize: 11, color: T.inkFaint, lineHeight: 1.7,
                  background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, border: `1px solid ${T.border}`,
                }}>
                  {progress?.message && (
                    <div>
                      <span style={{ color: T.cyan }}>STAGE</span> &nbsp; {progress.message}
                    </div>
                  )}
                  {recentLogs.map((log, i) => (
                    <div key={i}>
                      {fmtTime(log.at)} &nbsp;{' '}
                      <span style={{ color: log.level === 'error' ? T.red : log.level === 'warn' ? T.amber : T.cyan }}>
                        {log.level.toUpperCase()}
                      </span>{' '}
                      {log.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 22 }}>
            <CardHeader eyebrow="IDLE" title="No sync in progress" />
            <p style={{ marginTop: 12, color: T.inkDim, fontSize: 13, lineHeight: 1.65 }}>
              {ready ? (
                <>Click “Trigger sync” to run a two-way Garmin sync now.</>
              ) : (
                <>Complete Garmin sign-in for both regions to start syncing.</>
              )}
            </p>
            <div style={{ marginTop: 18, fontFamily: T.mono, fontSize: 11, color: T.inkFaint, lineHeight: 1.8 }}>
              <div>LAST.JOB &nbsp;&nbsp;<span style={{ color: T.ink }}>{jobs[0] ? jobs[0].id.slice(0, 8).toUpperCase() : '—'}</span></div>
              <div>LAST.AT &nbsp;&nbsp;&nbsp;<span style={{ color: T.ink }}>{jobs[0] ? fmtDate(jobs[0].finishedAt ?? jobs[0].queuedAt) : '—'}</span></div>
              <div>PLAN &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: me?.plan.canAutoSync ? T.lime : T.inkFaint }}>{planStatus(me?.plan ?? null)}</span></div>
            </div>
          </Card>
        )}

        <Card style={{ padding: 22 }}>
          <CardHeader eyebrow="GARMIN.ACCOUNTS" title="Garmin Account" />
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { code: 'CN', label: 'CN', host: 'sso.garmin.cn', acc: cnAcc },
              { code: 'INTL', label: 'International', host: 'sso.garmin.com', acc: intlAcc },
            ].map((r) => {
              const ok = r.acc?.hasSession ?? false;
              return (
                <div key={r.code} style={{ padding: 14, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ok ? T.lime : T.inkFaint }}>
                      {r.label}
                    </span>
                    <StatusBadge kind={ok ? 'success' : 'planned'} size="sm" />
                  </div>
                  <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: 11, color: T.inkDim, lineHeight: 1.7 }}>
                    <div>HOST &nbsp;&nbsp;<span style={{ color: T.ink }}>{r.host}</span></div>
                    <div>USER &nbsp;&nbsp;<span style={{ color: T.ink }}>{r.acc?.profile?.userName ?? r.acc?.profile?.fullName ?? '—'}</span></div>
                    <div>LAST &nbsp;&nbsp;<span style={{ color: T.ink }}>{r.acc?.lastValidatedAt ? fmtDate(r.acc.lastValidatedAt) : '—'}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            <Link href="/garmin" style={{ textDecoration: 'none' }}>
              <Btn variant="ghost" size="sm">Manage Account →</Btn>
            </Link>
          </div>
        </Card>
      </div>

      <SectionLabel>JOBS.LOG ·  {jobs.length} </SectionLabel>
      <Card>
        {jobs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.inkFaint, fontSize: 13 }}>
            No sync records yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['JOB.ID', 'MODE', 'TRIGGER', 'STATUS', 'STARTED', 'ELAPSED', 'UP / SKIP / FAIL'].map((h) => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', fontFamily: T.mono, fontSize: 10,
                      color: T.inkFaint, letterSpacing: 1.5, fontWeight: 600,
                      borderBottom: `1px solid ${T.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="track-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, color: T.lime, fontSize: 12 }}>
                      {j.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, color: T.cyan, fontSize: 11, letterSpacing: 1 }}>
                      {j.mode === 'history' ? 'HIST' : 'INCR'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, color: T.inkDim, fontSize: 11, letterSpacing: 1 }}>
                      {j.trigger === 'cron' ? 'AUTO' : 'MANUAL'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge kind={STATUS_MAP[j.status]} size="sm" />
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, color: T.inkDim, fontSize: 12 }}>
                      {fmtDate(j.startedAt ?? j.queuedAt)}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, color: T.inkDim, fontSize: 12 }}>
                      {elapsed(j.startedAt, j.finishedAt)}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 12 }}>
                      {j.error ? (
                        <span style={{ color: T.red }}>ERR · {j.error}</span>
                      ) : j.result ? (
                        <span style={{ color: T.ink }}>
                          {j.result.uploaded ?? 0}
                          <span style={{ color: T.inkFaint }}> / {j.result.skipped ?? 0} / </span>
                          <span style={{ color: (j.result.failed ?? 0) > 0 ? T.red : T.inkFaint }}>{j.result.failed ?? 0}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
