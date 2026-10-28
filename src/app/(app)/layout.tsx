'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { api, type MeResponse, type GarminAccountSummary } from '@/lib/api';
import { BrandIcon, T, TierBadge } from '@/components/track';

interface NavItem {
  href: string;
  label: string;
  matchPrefix?: string;
}

const NAV: NavItem[] = [
  { href: '/training', label: 'Training' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/profile', label: 'Athlete Profile' },
  { href: '/dashboard', label: 'Sync' },
  { href: '/garmin', label: 'Garmin' },
  { href: '/subscription', label: 'Plan' },
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
  return plan.plan === 'max' ? 'MAX' : 'PLUS';
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
        color: T.inkDim, fontFamily: T.sans, fontSize: 14,
      }}>
        <span className="track-blink">Loading…</span>
      </main>
    );
  }

  const role = (session.user as { role?: string }).role;
  const nav = role === 'admin' ? [...NAV, { href: '/admin', label: 'Admin' }] : NAV;

  const cnOk = accounts.find((a) => a.region === 'cn')?.hasSession ?? false;
  const intlOk = accounts.find((a) => a.region === 'global')?.hasSession ?? false;
  const paidDays = me?.plan.isPaidActive ? daysUntil(me?.plan.expiresAt ?? null) : null;
  const displayName =
    (session.user as { username?: string; name?: string; email: string }).username
    || session.user.name
    || session.user.email;

  const initial = (displayName || '?').trim().charAt(0).toUpperCase();
  const garminState = cnOk && intlOk ? 'both' : cnOk || intlOk ? 'one' : 'none';
  const garminColor = garminState === 'both' ? T.green : garminState === 'one' ? T.amber : T.inkFaint;
  const garminText = garminState === 'both'
    ? 'Garmin CN + Intl linked'
    : cnOk ? 'Garmin CN linked' : intlOk ? 'Garmin Intl linked' : 'Garmin not linked';

  return (
    <div className="track-page" style={{ paddingBottom: 80 }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,13,11,0.82)', backdropFilter: 'saturate(140%) blur(16px)',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          maxWidth: T.pageMaxW, margin: '0 auto', padding: '0 24px',
          minHeight: 64, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}>
          <Link href="/training" style={{
            display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: T.ink, flexShrink: 0,
          }}>
            <BrandIcon size={30} />
            <span style={{ fontSize: 16, fontWeight: 750, letterSpacing: '-0.01em' }}>
              Garmin <span style={{ color: T.lime }}>Trainer</span>
            </span>
          </Link>

          <nav
            aria-label="Main menu"
            className="track-scroll-x"
            style={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              overflowX: 'auto',
              minWidth: 0,
              flex: '1 1 auto',
              order: 0,
            }}
          >
            {nav.map((n) => {
              const active = pathname === n.href || pathname?.startsWith(n.href + '/');
              return (
                <Link key={n.href} href={n.href} className={active ? undefined : 'track-nav-link'} style={{
                  padding: '8px 13px',
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: active ? 650 : 500,
                  background: active ? 'rgba(198,255,58,0.12)' : 'transparent',
                  color: active ? T.lime : T.inkDim,
                  textDecoration: 'none', fontFamily: T.sans,
                  display: 'flex', alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}>
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: T.inkFaint, flexShrink: 0, marginLeft: 'auto' }}>
            <Link href="/garmin" title={garminText} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
              color: T.inkDim, fontSize: 12, fontWeight: 500,
              padding: '5px 10px', borderRadius: 999, border: `1px solid ${T.border}`,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: garminColor, boxShadow: garminState === 'none' ? 'none' : `0 0 8px ${garminColor}` }} />
              {garminState === 'both' ? 'CN + Intl' : cnOk ? 'CN' : intlOk ? 'Intl' : 'Link Garmin'}
            </Link>
            {me?.plan.isPaidActive && me.plan.plan !== 'free' ? (
              <span title={paidDays != null && paidDays < 3650 ? `${paidDays} days left` : 'Active'}>
                <TierBadge tier={me.plan.plan === 'max' ? 'max' : 'plus'} />
              </span>
            ) : (
              <Link href="/subscription" style={{
                padding: '3px 9px', borderRadius: 999, border: `1px solid ${T.border}`,
                color: T.inkDim, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textDecoration: 'none',
              }}>{planBadge(me?.plan ?? null)}</Link>
            )}
            <span title={displayName} style={{
              width: 30, height: 30, borderRadius: 999, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: T.panelRaised, border: `1px solid ${T.borderStrong}`,
              color: T.ink, fontSize: 13, fontWeight: 700,
            }}>{initial}</span>
            <button
              onClick={async () => {
                await signOut();
                router.push('/sign-in');
              }}
              className="track-link"
              style={{ background: 'transparent', border: 'none', fontFamily: T.sans, fontSize: 13, padding: 0, color: T.inkDim }}
            >Sign out</button>
          </div>
        </div>
      </header>
      <main style={{
        maxWidth: T.pageMaxW, margin: '0 auto', padding: '36px 24px',
      }}>{children}</main>
    </div>
  );
}
