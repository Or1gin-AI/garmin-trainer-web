'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, type GarminAccountSummary } from '@/lib/api';
import {
  T, Btn, Card, CardHeader, SectionLabel, StatusBadge, PageHero, Banner, Readout,
} from '@/components/track';

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
    const r = await api.get<{ accounts: GarminAccountSummary[] }>('/api/garmin/accounts');
    setAccounts(r.accounts);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    const err = params.get('error');
    const connected = params.get('connected');
    const region = params.get('region');
    const name = params.get('name');
    if (err) {
      setError(err);
      router.replace('/garmin');
    } else if (connected && region) {
      setSuccess(`${region === 'cn' ? '国区' : '国际区'} Garmin 已连接${name ? `（${name}）` : ''}`);
      refresh().finally(() => router.replace('/garmin'));
    }
  }, [params, router]);

  async function disconnect(region: Region) {
    if (!confirm(`断开 ${region === 'cn' ? '国区' : '国际区'} 的 Garmin 连接？`)) return;
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
    <>
      <PageHero
        eyebrow="ACCT.LINK"
        title="Garmin 账号"
        sub="点击下方按钮，在 Garmin 官方页面（sso.garmin.cn / sso.garmin.com）完成登录，登录成功后会自动绑定到当前账号。"
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}
      {success && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="ok" code="OK">{success}</Banner>
        </div>
      )}

      <SectionLabel>REGIONS</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 28 }}>
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

      <SectionLabel>FLOW</SectionLabel>
      <Card style={{ padding: 22 }}>
        <CardHeader eyebrow="HOW.IT.WORKS" title="连接流程" />
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            { n: '01', t: 'CLICK', d: '点击「连接 Garmin」按钮' },
            { n: '02', t: 'REDIRECT', d: '跳转到官方登录页 sso.garmin.cn / .com' },
            { n: '03', t: 'AUTH', d: '输入账号密码，必要时输入 MFA 验证码' },
            { n: '04', t: 'BIND', d: '浏览器自动跳回，账号变为「已连接」' },
          ].map((s) => (
            <div key={s.n} style={{
              padding: 14, border: `1px solid ${T.border}`, borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: T.lime, letterSpacing: -0.5 }}>{s.n}</div>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, marginTop: 6 }}>{s.t}</div>
              <div style={{ fontSize: 13, color: T.inkDim, marginTop: 6, lineHeight: 1.55 }}>{s.d}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 18, padding: 12, borderRadius: 6,
          background: T.cyanSoft, border: `1px solid ${T.cyan}30`,
          fontFamily: T.mono, fontSize: 11, color: T.cyan, letterSpacing: 0.6, lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600 }}>NOTE</span> &nbsp; 会话失效后页面会提示「请重新连接」，再点一次按钮即可。Pro/Max 用户可同时绑定 CN + INTL 双区。
        </div>
      </Card>
    </>
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
  const code = region === 'cn' ? 'CN' : 'INTL';
  const label = region === 'cn' ? '国区' : '国际区';
  const host = region === 'cn' ? 'sso.garmin.cn' : 'sso.garmin.com';
  const loginHref = `/garmin/connect/${region}`;
  const connected = !!account?.hasSession;

  return (
    <Card hot={connected} style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: connected ? T.lime : T.inkFaint, marginBottom: 4 }}>
            {label}
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{label}</h2>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, marginTop: 4 }}>{host}</div>
        </div>
        <StatusBadge kind={connected ? 'success' : 'planned'} />
      </div>

      {connected && account?.profile ? (
        <div style={{ marginTop: 16, padding: 14, background: 'rgba(0,0,0,0.25)', border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <Readout k="USER" v={account.profile.fullName || account.profile.userName || '—'} />
          {account.profile.location && <Readout k="LOCATION" v={account.profile.location} />}
          <Readout k="LAST.AUTH" v={fmtDate(account.lastValidatedAt)} vColor={T.lime} />
        </div>
      ) : (
        <div style={{
          marginTop: 16, padding: 18, border: `1px dashed ${T.border}`, borderRadius: 8,
          fontSize: 13, color: T.inkDim, textAlign: 'center',
        }}>
          还没有连接。点击下方按钮在 Garmin 官方页面登录。
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <Link href={loginHref} style={{ textDecoration: 'none' }}>
          <Btn variant={connected ? 'ghost' : 'primary'}>
            {connected ? '重新连接' : '连接 Garmin →'}
          </Btn>
        </Link>
        {connected && (
          <Btn variant="danger" style={{ marginLeft: 'auto' }} onClick={onDisconnect}>
            断开连接
          </Btn>
        )}
      </div>
    </Card>
  );
}
