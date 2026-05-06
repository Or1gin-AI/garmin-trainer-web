'use client';

import { useEffect, useState } from 'react';
import { api, type MeResponse } from '@/lib/api';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('zh-CN');
}

export default function SubscriptionPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await api.get<MeResponse>('/api/me');
    setMe(r);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await api.post<{ ok: boolean; planDays: number; expiresAt: string }>(
        '/api/redemption/redeem',
        { code: code.trim() },
      );
      setSuccess(`兑换成功，到期时间 ${fmtDate(r.expiresAt)}`);
      setCode('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAutoSync(enabled: boolean) {
    try {
      await api.patch('/api/me/auto-sync', { enabled });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-3xl font-bold">订阅</h1>
        <p className="text-zinc-500 mt-1">使用卡密激活或续期 Pro 订阅。</p>
      </header>

      <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500">当前套餐</p>
            <p className="text-2xl font-semibold mt-1">
              {me?.plan.isProActive ? (
                <>
                  Pro
                  <span className="ml-3 text-base font-normal text-zinc-500">
                    到期 {fmtDate(me?.plan.expiresAt ?? null)}
                  </span>
                </>
              ) : (
                <>
                  Free
                  <span className="ml-3 text-base font-normal text-zinc-500">
                    手动同步
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {me?.plan.isProActive && (
          <label className="flex items-center gap-2 pt-2 border-t border-zinc-100 mt-3 text-sm">
            <input
              type="checkbox"
              checked={me.plan.autoSyncEnabled}
              onChange={(e) => toggleAutoSync(e.target.checked)}
            />
            开启每 2 小时自动同步
          </label>
        )}
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">兑换卡密</h2>
        <form onSubmit={redeem} className="flex gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono"
          />
          <button
            type="submit"
            disabled={busy || !code}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
          >
            {busy ? '兑换中…' : '兑换'}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </section>

      <section className="text-sm text-zinc-500 space-y-2">
        <p className="font-medium text-zinc-700">Pro 权益</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>每 2 小时自动同步一次新增运动记录</li>
          <li>支持历史全量迁移</li>
          <li>同步失败优先重试</li>
        </ul>
      </section>
    </div>
  );
}
