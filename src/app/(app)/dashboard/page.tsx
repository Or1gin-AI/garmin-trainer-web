'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type SyncJob, type MeResponse, type GarminAccountSummary } from '@/lib/api';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('zh-CN');
}

function StatusPill({ status }: { status: SyncJob['status'] }) {
  const map: Record<SyncJob['status'], string> = {
    queued: 'bg-zinc-100 text-zinc-700',
    running: 'bg-blue-100 text-blue-700',
    success: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    aborted: 'bg-amber-100 text-amber-700',
  };
  const labels: Record<SyncJob['status'], string> = {
    queued: '排队中',
    running: '同步中',
    success: '成功',
    failed: '失败',
    aborted: '已中止',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [accounts, setAccounts] = useState<GarminAccountSummary[]>([]);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [current, setCurrent] = useState<SyncJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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

  // Poll while there's an active job
  useEffect(() => {
    const isActive =
      current && (current.status === 'queued' || current.status === 'running');
    if (isActive) {
      pollRef.current = setInterval(refresh, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [current?.status]);

  const cnReady = accounts.find((a) => a.region === 'cn')?.configured;
  const globalReady = accounts.find((a) => a.region === 'global')?.configured;
  const ready = cnReady && globalReady;

  async function startSync(mode: 'incremental' | 'history') {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/sync/jobs', { mode });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">同步控制台</h1>
          <p className="text-zinc-500 mt-1">
            把国区运动记录同步到国际区。
            {me?.plan.isProActive ? (
              <span className="ml-2 text-emerald-600 font-medium">
                Pro · 每 2 小时自动同步
              </span>
            ) : (
              <span className="ml-2 text-zinc-500">免费用户 · 仅手动同步</span>
            )}
          </p>
        </div>
      </header>

      {!ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          请先在「Garmin 账号」页面配置并验证国区与国际区两套 Garmin 账号。
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid sm:grid-cols-3 gap-4">
        <Card label="国区账号" value={cnReady ? '已配置' : '未配置'} ok={!!cnReady} />
        <Card label="国际区账号" value={globalReady ? '已配置' : '未配置'} ok={!!globalReady} />
        <Card
          label="最近自动同步"
          value={fmtDate(me?.plan.lastAutoSyncAt ?? null)}
          ok={!!me?.plan.lastAutoSyncAt}
        />
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">手动同步</h2>
          {current && <StatusPill status={current.status} />}
        </div>

        {current && (current.status === 'queued' || current.status === 'running') ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              {current.progress?.message || '准备中…'}
            </p>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${current.progress?.percent ?? 0}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500 grid grid-cols-4 gap-4">
              <span>扫描 {current.progress?.scanned ?? 0}</span>
              <span>上传 {current.progress?.uploaded ?? 0}</span>
              <span>跳过 {current.progress?.skipped ?? 0}</span>
              <span>失败 {current.progress?.failed ?? 0}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => startSync('incremental')}
              disabled={!ready || submitting}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700"
            >
              {submitting ? '提交中…' : '开始增量同步'}
            </button>
            <button
              onClick={() => startSync('history')}
              disabled={!ready || submitting || !me?.plan.isProActive}
              title={!me?.plan.isProActive ? '历史全量迁移仅 Pro 用户可用' : ''}
              className="px-4 py-2 rounded-lg border border-zinc-300 hover:border-zinc-400 disabled:opacity-50"
            >
              历史全量迁移 {!me?.plan.isProActive && '(Pro)'}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">最近同步记录</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无记录</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-left">
              <tr>
                <th className="font-normal py-2">时间</th>
                <th className="font-normal">模式</th>
                <th className="font-normal">触发</th>
                <th className="font-normal">状态</th>
                <th className="font-normal">上传/跳过/失败</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-zinc-100">
                  <td className="py-2">{fmtDate(j.queuedAt)}</td>
                  <td>{j.mode === 'incremental' ? '增量' : '历史'}</td>
                  <td>{j.trigger === 'cron' ? '自动' : '手动'}</td>
                  <td>
                    <StatusPill status={j.status} />
                  </td>
                  <td className="text-zinc-600">
                    {j.result
                      ? `${j.result.uploaded ?? 0} / ${j.result.skipped ?? 0} / ${j.result.failed ?? 0}`
                      : j.error
                        ? <span className="text-red-600">{j.error}</span>
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-2xl font-semibold mt-2 ${ok ? '' : 'text-zinc-400'}`}>
        {value}
      </p>
    </div>
  );
}
