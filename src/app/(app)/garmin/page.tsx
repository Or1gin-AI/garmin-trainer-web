'use client';

import { useEffect, useState } from 'react';
import { api, type GarminAccountSummary } from '@/lib/api';

type Region = 'cn' | 'global';

export default function GarminPage() {
  const [accounts, setAccounts] = useState<GarminAccountSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    const r = await api.get<{ accounts: GarminAccountSummary[] }>(
      '/api/garmin/accounts',
    );
    setAccounts(r.accounts);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Garmin 账号</h1>
        <p className="text-zinc-500 mt-1">
          配置并验证你的国区与国际区 Garmin 账号。账号密码会加密存储到服务器（每用户独立密钥），
          仅用于同步运动记录。
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {(['cn', 'global'] as Region[]).map((region) => {
          const acc = accounts.find((a) => a.region === region);
          return (
            <RegionCard
              key={region}
              region={region}
              account={acc}
              onChange={async () => {
                setError(null);
                setSuccess(null);
                await refresh();
              }}
              onError={(m) => {
                setError(m);
                setSuccess(null);
              }}
              onSuccess={(m) => {
                setSuccess(m);
                setError(null);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function RegionCard({
  region,
  account,
  onChange,
  onError,
  onSuccess,
}: {
  region: Region;
  account: GarminAccountSummary | undefined;
  onChange: () => Promise<void>;
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const label = region === 'cn' ? '国区 (garmin.cn)' : '国际区 (garmin.com)';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  async function save() {
    setBusy(true);
    try {
      await api.post('/api/garmin/accounts', { region, username, password });
      setUsername('');
      setPassword('');
      await onChange();
      onSuccess(`${label} 已保存`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setMfaRequired(false);
    try {
      const r = await api.post<{ ok: boolean; mfaRequired?: boolean }>(
        '/api/garmin/verify',
        { region },
      );
      if (r.ok) {
        await onChange();
        onSuccess(`${label} 验证通过`);
      } else if (r.mfaRequired) {
        setMfaRequired(true);
        onError('Garmin 要求 MFA 验证码，请输入收到的 6 位验证码');
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa() {
    setBusy(true);
    try {
      await api.post('/api/garmin/verify/mfa', { region, code: mfaCode });
      setMfaCode('');
      // After submitting MFA, retry verify to actually load profile
      await verify();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`确定移除 ${label} 的账号绑定？`)) return;
    setBusy(true);
    try {
      await api.del(`/api/garmin/accounts/${region}`);
      await onChange();
      onSuccess(`${label} 已移除`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            account?.hasSession
              ? 'bg-emerald-100 text-emerald-700'
              : account?.configured
                ? 'bg-amber-100 text-amber-700'
                : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {account?.hasSession ? '已连接' : account?.configured ? '待验证' : '未配置'}
        </span>
      </div>

      {account?.profile && (
        <div className="text-sm text-zinc-600 bg-zinc-50 rounded-lg p-3">
          <div>{account.profile.fullName || account.profile.userName}</div>
          {account.profile.location && (
            <div className="text-xs text-zinc-500">{account.profile.location}</div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">账号</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={account?.configured ? '已保存（留空保留）' : '邮箱 / 用户名'}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={account?.configured ? '已保存（留空保留）' : '密码'}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={save}
            disabled={busy || !username || !password}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-50"
          >
            保存
          </button>
          <button
            onClick={verify}
            disabled={busy || !account?.configured}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
          >
            验证连接
          </button>
          {account?.configured && (
            <button
              onClick={remove}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm disabled:opacity-50 ml-auto"
            >
              移除
            </button>
          )}
        </div>

        {mfaRequired && (
          <div className="space-y-2 border-t border-zinc-200 pt-3">
            <label className="text-sm font-medium">MFA 验证码</label>
            <div className="flex gap-2">
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="6 位验证码"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2"
              />
              <button
                onClick={submitMfa}
                disabled={busy || !mfaCode}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
              >
                提交
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
