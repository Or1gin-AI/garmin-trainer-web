'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { api, type MeResponse, type GarminAccountSummary } from '@/lib/api';
import { BrandIcon, T } from '@/components/track';

interface NavItem {
  href: string;
  label: string;
  sub: string;
  matchPrefix?: string;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: '同步', sub: 'SYNC' },
  { href: '/training', label: '训练', sub: 'TRAIN' },
  { href: '/calendar', label: '日历', sub: 'CAL' },
  { href: '/garmin', label: 'Garmin', sub: 'ACCT' },
  { href: '/subscription', label: '订阅', sub: 'SUB' },
];

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffMs = t - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 86400000);
}

function planBadge(plan: MeResponse['plan'] | null) {
  if (!plan || plan.plan === 'free') return 'FREE';
  return plan.plan === 'max' ? 'MAX' : 'PRO';
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [accounts, setAccounts] = useState<GarminAccountSummary[]>([]);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/sign-in');
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    api.get<MeResponse>('/api/me').then(setMe).catch(() => {});
    api.get<{ accounts: GarminAccountSummary[] }>('/api/garmin/accounts')
      .then((r) => setAccounts(r.accounts))
      .catch(() => {});
  }, [session]);

  if (isPending || !session) {
    return (
      <main className="track-page" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.inkDim, fontFamily: T.mono, fontSize: 12, letterSpacing: 1.5,
      }}>
        <span className="track-blink">LOADING…</span>
      </main>
    );
  }

  const role = (session.user as { role?: string }).role;
  const nav = role === 'admin' ? [...NAV, { href: '/admin', label: '管理后台', sub: 'ADMIN' }] : NAV;

  const cnOk = accounts.find((a) => a.region === 'cn')?.hasSession ?? false;
  const intlOk = accounts.find((a) => a.region === 'global')?.hasSession ?? false;
  const paidDays = me?.plan.isPaidActive ? daysUntil(me?.plan.expiresAt ?? null) : null;
  const displayName =
    (session.user as { username?: string; name?: string; email: string }).username
    || session.user.name
    || session.user.email;

  return (
    <div className="track-page" style={{ paddingBottom: 80 }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(11,14,12,0.86)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          maxWidth: T.pageMaxW, margin: '0 auto', padding: '0 28px',
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        }}>
          <Link href="/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: T.ink,
          }}>
            <BrandIcon size={34} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.3, lineHeight: 1 }}>GARMIN TRAINER</div>
              <div style={{ fontSize: 10, color: T.inkFaint, fontFamily: T.mono, marginTop: 2, letterSpacing: 1 }}>
                CN.SES <span style={{ color: cnOk ? T.green : T.inkFaint }}>{cnOk ? 'OK' : '—'}</span>
                {' '}·{' '}
                INTL.SES <span style={{ color: intlOk ? T.green : T.inkFaint }}>{intlOk ? 'OK' : '—'}</span>
              </div>
            </div>
          </Link>

          <nav style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {nav.map((n) => {
              const active = pathname === n.href || pathname?.startsWith(n.href + '/');
              return (
                <Link key={n.href} href={n.href} style={{
                  padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  background: active ? T.lime : 'transparent',
                  color: active ? T.bg : T.inkDim,
                  textDecoration: 'none', fontFamily: T.sans,
                  display: 'flex', alignItems: 'baseline', gap: 8,
                }}>
                  <span>{n.label}</span>
                  <span style={{
                    fontFamily: T.mono, fontSize: 9, letterSpacing: 1.5,
                    color: active ? 'rgba(11,14,12,0.5)' : T.inkFaint,
                  }}>{n.sub}</span>
                </Link>
              );
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: T.inkFaint }}>
            {me?.plan.isPaidActive ? (
              <span style={{
                padding: '3px 8px', borderRadius: 4, border: `1px solid ${T.amber}40`,
                color: T.amber, fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, fontWeight: 600,
              }}>★ {planBadge(me?.plan ?? null)}{paidDays != null ? ` · ${paidDays}D` : ''}</span>
            ) : (
              <Link href="/subscription" style={{
                padding: '3px 8px', borderRadius: 4, border: `1px solid ${T.border}`,
                color: T.inkDim, fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, fontWeight: 600,
                textDecoration: 'none',
              }}>FREE</Link>
            )}
            <span style={{ fontFamily: T.mono, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </span>
            <button
              onClick={async () => {
                await signOut();
                router.push('/sign-in');
              }}
              className="track-link"
              style={{ background: 'transparent', border: 'none', fontFamily: T.sans, fontSize: 12, padding: 0 }}
            >退出</button>
          </div>
        </div>
      </header>
      <main style={{
        maxWidth: T.pageMaxW, margin: '0 auto', padding: '32px 28px',
      }}>{children}</main>
    </div>
  );
}
