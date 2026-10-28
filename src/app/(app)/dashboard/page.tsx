'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type SyncJob, type MeResponse, type GarminAccountSummary } from '@/lib/api';
import {
  T, Btn, Card, CardHeader, StatTile, SectionLabel, StatusBadge, PageHero, Banner, LABEL, Pill,
  type StatusKind,
} from '@/components/track';

const JOBS_SHOWN = 12;

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function relative(d: string | null): string {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  if (!Number.isFinite(diff)) return '—';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

function elapsed(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return '—';
  const sec = Math.floor((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const ss = sec % 60;
  if (m < 60) return `${m}m ${ss}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Turn raw sync errors into something a person can act on. */
function friendlyError(err: string): string {
  if (/invalid_grant|refresh failed|401|unauthori[sz]ed|reconnect|重新连接/i.test(err)) {
    return 'Garmin sign-in expired — reconnect your account.';
  }
  if (/network|timeout|ECONN|ETIMEDOUT/i.test(err)) return 'Network error reaching Garmin. Will retry automatically.';
  if (/429|too many/i.test(err)) return 'Garmin rate-limited the request. Will retry later.';
  return err.length > 90 ? `${err.slice(0, 90)}…` : err;
}

const STATUS_MAP: Record<SyncJob['status'], StatusKind> = {
  queued: 'queued',
  running: 'running',
  success: 'success',
  failed: 'failed',
  aborted: 'aborted',
};

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
  const successJobs = jobs.filter((j) => j.status === 'success');
  const totalUploaded = successJobs.reduce((s, j) => s + (j.result?.uploaded ?? 0), 0);
  const lastSuccess = successJobs[0] ?? null;
  const latestJob = jobs[0] ?? null;
  const latestFailedAuth = latestJob?.status === 'failed' && latestJob.error && /invalid_grant|refresh failed|401|unauthori[sz]ed/i.test(latestJob.error);
  const shownJobs = jobs.slice(0, JOBS_SHOWN);

  const progress = current?.progress;
  const percent = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)));
  const recentLogs = (progress?.logs ?? []).slice(-4).reverse();

  return (
    <>
      <PageHero
        eyebrow="Garmin sync"
        title="Activity Sync"
        sub={
          me?.plan.canAutoSync
            ? 'Activities flow both ways between Garmin China and Garmin International. Automatic sync runs every 2 hours — or trigger one now.'
            : 'Keep Garmin China and Garmin International in sync. Sync isn’t enabled for this account yet — contact the admin to turn it on.'
        }
        actions={
          <>
            <Btn variant="ghost" onClick={() => refresh().catch(() => {})}>↻ Refresh</Btn>
            <Btn onClick={triggerSync} disabled={busy || !ready || !me?.plan.canAutoSync}>
              {busy ? 'Starting…' : 'Sync now'}
            </Btn>
          </>
        }
      />

      {(!ready || latestFailedAuth) && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="warn" code={latestFailedAuth ? 'Reconnect needed' : 'Setup needed'}>
            {latestFailedAuth
              ? 'Garmin signed this app out, so recent syncs could not run. Reconnect your Garmin accounts to resume.'
              : 'Connect both your Garmin China and Garmin International accounts to start syncing.'}
            <Link href="/garmin" className="track-link" style={{ marginLeft: 8, fontWeight: 600 }}>Go to Garmin accounts →</Link>
          </Banner>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatTile
          label="Garmin China"
          value={cnReady ? 'Connected' : 'Not linked'}
          mono={false}
          accent={cnReady ? T.green : T.inkFaint}
          hint={cnAcc?.lastValidatedAt ? `Checked ${relative(cnAcc.lastValidatedAt)}` : undefined}
        />
        <StatTile
          label="Garmin International"
          value={globalReady ? 'Connected' : 'Not linked'}
          mono={false}
          accent={globalReady ? T.green : T.inkFaint}
          hint={intlAcc?.lastValidatedAt ? `Checked ${relative(intlAcc.lastValidatedAt)}` : undefined}
        />
        <StatTile
          label="Synced recently"
          value={totalUploaded.toLocaleString('en-US')}
          accent={T.cyan}
          hint={`Activities uploaded in the last ${jobs.length} runs`}
        />
        <StatTile
          label="Last successful sync"
          value={lastSuccess ? relative(lastSuccess.finishedAt ?? lastSuccess.queuedAt) : '—'}
          mono={false}
          accent={T.lime}
          hint={me?.plan.canAutoSync ? 'Auto sync every 2 hours' : 'Auto sync off'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 28 }}>
        {current && (current.status === 'queued' || current.status === 'running') ? (
          <Card hot glow style={{ padding: 22 }}>
            <CardHeader
              eyebrow="In progress"
              title={current.status === 'queued' ? 'Waiting to start…' : 'Syncing activities'}
              right={<StatusBadge kind={STATUS_MAP[current.status]} />}
            />
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 16 }}>
              {[
                ['Type', current.mode === 'history' ? 'History backfill' : 'Incremental'],
                ['Trigger', current.trigger === 'cron' ? 'Automatic' : 'Manual'],
                ['Started', fmtTime(current.startedAt ?? current.queuedAt)],
                ['Elapsed', elapsed(current.startedAt ?? current.queuedAt, null)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ ...LABEL, fontSize: 10 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.inkDim, marginBottom: 8 }}>
                <span>
                  <span style={{ color: T.lime, fontWeight: 700 }}>{progress?.uploaded ?? 0}</span> uploaded
                  {' '}· {progress?.skipped ?? 0} skipped
                  {' '}· <span style={{ color: (progress?.failed ?? 0) > 0 ? T.red : T.inkFaint }}>{progress?.failed ?? 0} failed</span>
                </span>
                <span style={{ color: T.lime, fontWeight: 700 }}>{percent}%</span>
              </div>
              <div style={{ height: 8, background: T.border, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${percent}%`, height: '100%', background: T.lime, borderRadius: 999, transition: 'width .25s' }} />
              </div>
              {(progress?.message || recentLogs.length > 0) && (
                <div style={{
                  marginTop: 14, fontFamily: T.mono, fontSize: 12, color: T.inkFaint, lineHeight: 1.7,
                  background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 10, border: `1px solid ${T.border}`,
                }}>
                  {progress?.message && <div style={{ color: T.ink }}>{progress.message}</div>}
                  {recentLogs.map((log, i) => (
                    <div key={i}>
                      {fmtTime(log.at)}{' '}
                      <span style={{ color: log.level === 'error' ? T.red : log.level === 'warn' ? T.amber : T.cyan }}>
                        {log.level}
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
            <CardHeader eyebrow="Status" title={ready && !latestFailedAuth ? 'All caught up' : 'Sync paused'} />
            <p style={{ marginTop: 10, color: T.inkDim, fontSize: 14, lineHeight: 1.65 }}>
              {ready && !latestFailedAuth
                ? 'No sync is running. New activities are picked up automatically, or press “Sync now” to run one immediately.'
                : 'Reconnect Garmin to resume syncing. Your existing activities and training plans are unaffected.'}
            </p>
            <div style={{ marginTop: 16, display: 'grid', gap: 2 }}>
              <Row k="Last run" v={latestJob ? `${fmtDate(latestJob.finishedAt ?? latestJob.queuedAt)} · ${latestJob.status}` : '—'} />
              <Row k="Last success" v={lastSuccess ? fmtDate(lastSuccess.finishedAt ?? lastSuccess.queuedAt) : '—'} />
              <Row k="Auto sync" v={me?.plan.canAutoSync ? 'On · every 2 hours' : 'Off'} color={me?.plan.canAutoSync ? T.lime : T.inkFaint} />
            </div>
          </Card>
        )}

        <Card style={{ padding: 22 }}>
          <CardHeader eyebrow="Accounts" title="Garmin accounts" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { code: 'CN', label: 'Garmin China', host: 'garmin.cn', acc: cnAcc },
              { code: 'INTL', label: 'Garmin International', host: 'garmin.com', acc: intlAcc },
            ].map((r) => {
              const ok = r.acc?.hasSession ?? false;
              return (
                <div key={r.code} style={{ padding: 14, border: `1px solid ${T.border}`, borderRadius: 12, background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{r.label}</span>
                    {ok ? <Pill color={T.green} size="sm">Connected</Pill> : <Pill color={T.inkFaint} size="sm">Not linked</Pill>}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: T.inkDim }}>
                    {r.acc?.profile?.fullName || r.acc?.profile?.userName || 'Not linked'}
                    <span style={{ color: T.inkFaint }}> · {r.host}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            <Link href="/garmin" style={{ textDecoration: 'none' }}>
              <Btn variant="ghost" size="sm">Manage accounts →</Btn>
            </Link>
          </div>
        </Card>
      </div>

      <SectionLabel right={jobs.length > JOBS_SHOWN ? <span style={{ fontSize: 12, color: T.inkFaint }}>Showing latest {JOBS_SHOWN} of {jobs.length}</span> : null}>
        Recent sync runs
      </SectionLabel>
      <Card>
        {jobs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.inkFaint, fontSize: 14 }}>
            No sync runs yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Status', 'When', 'Type', 'Duration', 'Result'].map((h) => (
                    <th key={h} style={{
                      ...LABEL, fontSize: 10, padding: '12px 16px', textAlign: 'left',
                      borderBottom: `1px solid ${T.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownJobs.map((j) => (
                  <tr key={j.id} className="track-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge kind={STATUS_MAP[j.status]} size="sm" />
                    </td>
                    <td style={{ padding: '12px 16px', color: T.ink, whiteSpace: 'nowrap' }}>
                      {fmtDate(j.startedAt ?? j.queuedAt)}
                    </td>
                    <td style={{ padding: '12px 16px', color: T.inkDim, whiteSpace: 'nowrap' }}>
                      {j.mode === 'history' ? 'Backfill' : 'Incremental'} · {j.trigger === 'cron' ? 'auto' : 'manual'}
                    </td>
                    <td style={{ padding: '12px 16px', color: T.inkDim, fontVariantNumeric: 'tabular-nums' }}>
                      {elapsed(j.startedAt, j.finishedAt)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {j.error ? (
                        <span style={{ color: T.amber }} title={j.error}>{friendlyError(j.error)}</span>
                      ) : j.result ? (
                        <span style={{ color: T.ink }}>
                          <b>{j.result.uploaded ?? 0}</b> uploaded
                          <span style={{ color: T.inkFaint }}> · {j.result.skipped ?? 0} skipped</span>
                          {(j.result.failed ?? 0) > 0 && <span style={{ color: T.red }}> · {j.result.failed} failed</span>}
                        </span>
                      ) : (
                        <span style={{ color: T.inkFaint }}>—</span>
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

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
      <span style={{ color: T.inkFaint }}>{k}</span>
      <span style={{ color: color ?? T.ink, fontWeight: 500 }}>{v}</span>
    </div>
  );
}
