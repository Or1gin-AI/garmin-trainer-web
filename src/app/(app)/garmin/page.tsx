'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, type GarminAccountSummary } from '@/lib/api';
import {
  T, Btn, Card, CardHeader, SectionLabel, StatusBadge, PageHero, Banner, Readout,
} from '@/components/track';

type Region = 'cn' | 'global';

const BIND_LIMIT_NOTICE = 'To prevent account sync abuse, a Garmin account can only be linked once per region every 7 days. Confirm that this is your account before continuing.';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US');
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
      setSuccess(`${region === 'cn' ? 'CN' : 'International'} Garmin Connected${name ? `（${name}）` : ''}`);
      refresh().finally(() => router.replace('/garmin'));
    }
  }, [params, router]);

  async function disconnect(region: Region) {
    if (!confirm(`Disconnect ${region === 'cn' ? 'CN' : 'International'}  Garmin Connect ？`)) return;
    setError(null);
    try {
      await api.del(`/api/garmin/accounts/${region}`);
      await refresh();
      setSuccess('Disconnect');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="ACCT.LINK"
        title="Garmin Account"
        sub="Use the button below to sign in on the official Garmin page (sso.garmin.cn / sso.garmin.com). After sign-in, the account will be linked automatically."
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
      <div style={{ marginBottom: 20 }}>
        <Banner kind="warn" code="BIND.LIMIT">
          {BIND_LIMIT_NOTICE}
        </Banner>
      </div>

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
        <CardHeader eyebrow="HOW.IT.WORKS" title="Connection flow" />
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            { n: '01', t: 'CLICK', d: 'Click “Connect Garmin”' },
            { n: '02', t: 'REDIRECT', d: 'Open the official Garmin sign-in page sso.garmin.cn / .com' },
            { n: '03', t: 'AUTH', d: 'Enter your Garmin account password and MFA code if required' },
            { n: '04', t: 'BIND', d: 'The browser returns automatically and the account becomes “Connected”' },
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
          <span style={{ fontWeight: 600 }}>NOTE</span> &nbsp; When the session expires, the page will prompt you to reconnect. Plus/Max users can link both CN and international regions, subject to the 7-day limit for each region.
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
  const label = region === 'cn' ? 'CN' : 'International';
  const host = region === 'cn' ? 'sso.garmin.cn' : 'sso.garmin.com';
  const loginHref = `/garmin/connect/${region}`;
  const connected = !!account?.hasSession;
  const canBind = account?.canBind !== false;
  const nextBindText = fmtDate(account?.nextBindAllowedAt ?? null);
  const bindConfirmText = `${label} Garmin account linking succeeds, it cannot be linked again in the same region for 7 days. Confirm that this is your Garmin account. Continue?`;

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
          <Readout k="LAST.BIND" v={fmtDate(account.lastBoundAt ?? null)} />
        </div>
      ) : (
        <div style={{
          marginTop: 16, padding: 18, border: `1px dashed ${T.border}`, borderRadius: 8,
          fontSize: 13, color: T.inkDim, textAlign: 'center',
        }}>
          Not connected. Use the button below to sign in on the official Garmin page.
        </div>
      )}

      {!canBind && (
        <div style={{
          marginTop: 12,
          padding: '9px 10px',
          borderRadius: 6,
          border: `1px solid ${T.amber}35`,
          background: T.amberSoft,
          color: T.amber,
          fontFamily: T.mono,
          fontSize: 10,
          letterSpacing: 0.8,
          lineHeight: 1.6,
        }}>
          7 daysLink cooldown · {nextBindText} before linking again
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        {canBind ? (
          <Link
            href={loginHref}
            style={{ textDecoration: 'none' }}
            onClick={(e) => {
              if (!window.confirm(bindConfirmText)) e.preventDefault();
            }}
          >
            <Btn variant={connected ? 'ghost' : 'primary'}>
              {connected ? 'Reconnect' : 'Connect Garmin →'}
            </Btn>
          </Link>
        ) : (
          <Btn variant="ghost" disabled>
            {connected ? 'Reconnect' : 'Connect Garmin →'}
          </Btn>
        )}
        {connected && (
          <Btn variant="danger" style={{ marginLeft: 'auto' }} onClick={onDisconnect}>
            Disconnect
          </Btn>
        )}
      </div>
    </Card>
  );
}
