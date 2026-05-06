'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, type GarminAccountSummary } from '@/lib/api';

type Region = 'cn' | 'global';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('zh-CN');
}

export default function GarminPage() {
  const router = useRouter();
  const params = useSearchParams();
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

  // Pick up redirect callback flags from /api/garmin/callback/:region
  useEffect(() => {
    const err = params.get('error');
    const connected = params.get('connected');
    const region = params.get('region');
    const name = params.get('name');
    if (err) {
      setError(err);
      router.replace('/garmin');
    } else if (connected && region) {
      setSuccess(
        `${region === 'cn' ? '国区' : '国际区'} Garmin 已连接${name ? `（${name}）` : ''}`,
      );
      refresh().finally(() => router.replace('/garmin'));
    }
  }, [params, router]);

  async function disconnect(region: Region) {
    if (!confirm(`断开 ${region === 'cn' ? '国区' : '国际区'} 的 Garmin 连接？`)) {
      return;
    }
    setError(null);
    try {
      await api.del(`/api/garmin/accounts/${region}`);
      await refresh();
      setSuccess('已断开');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Garmin 账号</h1>
        <p className="text-zinc-500 mt-1 leading-relaxed">
          点击下方按钮在 <span className="font-mono">Garmin 官方页面</span> 完成登录，
          Garmin 会自动把登录凭据回传给我们。
          <span className="text-emerald-700 font-medium ml-1">
            你的 Garmin 密码不会经过我们的服务器。
          </span>
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
              onDisconnect={() => disconnect(region)}
            />
          );
        })}
      </div>

      <section className="text-sm text-zinc-500 space-y-2">
        <p className="font-medium text-zinc-700">连接流程</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>点击下方"连接 Garmin"按钮</li>
          <li>跳转到 Garmin 官方登录页（域名：sso.garmin.cn / sso.garmin.com）</li>
          <li>输入账号密码（如启用了 MFA，输入验证码）</li>
          <li>登录成功后浏览器自动跳回，账号变为"已连接"</li>
        </ol>
        <p className="pt-2">
          会话失效后页面会提示"请重新连接"，再点一次按钮即可。
        </p>
      </section>
    </div>
  );
}

function RegionCard({
  region,
  account,
  onDisconnect,
}: {
  region: Region;
  account: GarminAccountSummary | undefined;
  onDisconnect: () => void;
}) {
  const label = region === 'cn' ? '国区 (garmin.cn)' : '国际区 (garmin.com)';
  const loginHref = `/garmin/connect/${region}`;
  const connected = !!account?.hasSession;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            connected
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {connected ? '已连接' : '未连接'}
        </span>
      </div>

      {account?.profile ? (
        <div className="text-sm text-zinc-600 bg-zinc-50 rounded-lg p-3">
          <div className="font-medium">
            {account.profile.fullName || account.profile.userName}
          </div>
          {account.profile.location && (
            <div className="text-xs text-zinc-500 mt-0.5">
              {account.profile.location}
            </div>
          )}
          <div className="text-xs text-zinc-400 mt-1">
            最后验证 {fmtDate(account.lastValidatedAt)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          还没有连接。点击下方按钮在 Garmin 官方页面登录。
        </p>
      )}

      <div className="flex gap-2">
        <a
          href={loginHref}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
            connected
              ? 'border border-zinc-300 hover:border-zinc-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {connected ? '重新连接' : '连接 Garmin'}
        </a>
        {connected && (
          <button
            onClick={onDisconnect}
            className="ml-auto text-sm text-red-600 hover:underline"
          >
            断开
          </button>
        )}
      </div>
    </div>
  );
}
