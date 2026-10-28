'use client';

import { useEffect, useState } from 'react';
import { api, type MeResponse, type ReferralStats } from '@/lib/api';
import {
  T, Btn, Card, CardHeader, PageHero, Banner, TrackInput,
} from '@/components/track';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US');
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}

const PAY_URLS = {
  pro: 'https://pay.ldxp.cn/item/3xvbsa',
  max: 'https://pay.ldxp.cn/item/epjyle',
} as const;

const PLANS: {
  name: 'PLUS' | 'MAX';
  price: string;
  period: string;
  desc: string;
  features: string[];
  href: string;
  hot?: boolean;
}[] = [
  {
    name: 'PLUS',
    price: '¥5',
    period: '/month',
    desc: 'Automatic Garmin data sync',
    features: [
      'Automatic activity sync every 2 hours',
      'Full activity history backfill',
      'Automatic retry on failed syncs',
      'Garmin China + Garmin International',
    ],
    href: PAY_URLS.pro,
  },
  {
    name: 'MAX',
    price: '¥15',
    period: '/month',
    desc: 'AI training plans + everything in Plus',
    features: [
      'All Plus sync features',
      'Personalized weekly training plans from AI',
      'Chat with the AI Coach to adjust workouts and get answers',
      'Export training plans (PDF / Word / Excel)',
      'One-click upload to your Garmin calendar',
    ],
    href: PAY_URLS.max,
    hot: true,
  },
];

function planLabel(plan: MeResponse['plan']['plan'] | undefined) {
  if (plan === 'max') return 'MAX';
  if (plan === 'pro') return 'PLUS';
  return 'FREE';
}

function redeemedPlanLabel(plan: 'pro' | 'max') {
  return plan === 'pro' ? 'PLUS' : 'MAX';
}

export default function SubscriptionPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [refStats, setRefStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
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
    api.get<ReferralStats>('/api/referral/stats').then(setRefStats).catch(() => {});
  }, []);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await api.post<{ ok: boolean; subscriptionPlan: 'pro' | 'max'; planDays: number; expiresAt: string }>(
        '/api/redemption/redeem',
        { code: code.trim() },
      );
      setSuccess(`Code redeemed. ${redeemedPlanLabel(r.subscriptionPlan)} is active until ${fmtDate(r.expiresAt)}.`);
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

  function confirmExternalPurchase(planName: 'PLUS' | 'MAX'): boolean {
    return window.confirm(
      `You’re about to buy ${planName} in our external store. After paying, copy your code and come back to this page to redeem it. Continue?`,
    );
  }

  const activePlan = me?.plan.plan ?? 'free';
  const isPaid = activePlan !== 'free';
  const planDays = isPaid ? daysUntil(me?.plan.expiresAt ?? null) : null;
  const canAutoSync = me?.plan.canAutoSync ?? false;
  const canUseAi = me?.plan.canUseAi ?? false;
  const autoSync = me?.plan.autoSyncEnabled ?? false;

  const promoUntil = me?.plan.promoFreeMaxUntil ?? null;

  return (
    <>
      <PageHero
        title="Subscription"
        sub="Choose a plan to unlock automatic sync and AI coaching."
      />

      {promoUntil && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            padding: '14px 18px', borderRadius: 10,
            background: T.limeGlow, border: `1px solid ${T.lime}60`,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              color: T.bg, background: T.lime, padding: '3px 8px', borderRadius: 3,
            }}>LIMITED</span>
            <span style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>
              Limited-time offer: Max is free for everyone until {fmtDate(promoUntil)}
            </span>
            <span style={{ fontSize: 12, color: T.inkDim }}>
              Enjoy the AI Coach and automatic sync, and invite 2 friends to earn an extra month of Max.
            </span>
          </div>
        </div>
      )}

      {success && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="ok" code="OK">{success}</Banner>
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      {/* Current plan status */}
      <Card hot={isPaid} glow={isPaid} style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: isPaid ? T.lime : T.ink }}>
                {planLabel(activePlan)}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, letterSpacing: 1 }}>
                {isPaid ? (
                  <>Expires {fmtDate(me?.plan.expiresAt ?? null)}{planDays != null && planDays < 3650 && <> · <span style={{ color: T.amber }}>{planDays} {planDays === 1 ? 'day' : 'days'} left</span></>}</>
                ) : (
                  'Free · manual sync only'
                )}
              </span>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Mini k="Auto sync" v={canAutoSync && autoSync ? 'On' : canAutoSync ? 'Off' : 'Plus & Max'} c={canAutoSync && autoSync ? T.lime : T.amber} />
              <Mini k="AI Coach" v={canUseAi ? 'Unlocked' : 'Max only'} c={canUseAi ? T.lime : T.inkFaint} />
              <Mini k="Regions" v="CN + Intl" c={T.ink} />
            </div>
          </div>
          {canAutoSync && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none',
              padding: '10px 14px', border: `1px solid ${autoSync ? T.lime : T.border}`,
              borderRadius: 8, background: autoSync ? T.limeGlow : 'transparent',
            }}>
              <span style={{ position: 'relative', width: 36, height: 20, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => toggleAutoSync(e.target.checked)}
                  style={{ position: 'absolute', opacity: 0, inset: 0, margin: 0, cursor: 'pointer' }}
                />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: 999,
                  background: autoSync ? T.lime : T.borderStrong, transition: 'background .15s',
                }} />
                <span style={{
                  position: 'absolute', top: 2, left: autoSync ? 18 : 2, width: 16, height: 16, borderRadius: 999,
                  background: '#0b0e0c', transition: 'left .15s',
                }} />
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 1.2, color: autoSync ? T.lime : T.inkDim }}>
                Auto sync · every 2 hours
              </span>
            </label>
          )}
        </div>
      </Card>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 28 }}>
        {PLANS.map((p) => (
          <Card key={p.name} hot={p.hot} style={{ padding: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {p.hot && (
              <div style={{
                position: 'absolute', top: -1, left: 0, right: 0, height: 2, background: T.lime,
              }} />
            )}
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, letterSpacing: 2, color: p.hot ? T.lime : T.ink }}>{p.name}</span>
                {p.hot && (
                  <span style={{
                    fontFamily: T.mono, fontSize: 9, letterSpacing: 1.5,
                    color: T.bg, background: T.lime, padding: '2px 8px', borderRadius: 3, fontWeight: 700,
                  }}>Recommended</span>
                )}
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: T.ink }}>{p.price}</span>
                <span style={{ fontSize: 14, color: T.inkDim }}>{p.period}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: T.inkDim }}>{p.desc}</div>
            </div>
            <ul style={{
              flex: 1, margin: 0, padding: '18px 24px', listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {p.features.map((f) => (
                <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
                  <span style={{ color: p.hot ? T.lime : T.cyan, fontFamily: T.mono, flexShrink: 0 }}>+</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div style={{ padding: '0 24px 24px' }}>
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!confirmExternalPurchase(p.name)) e.preventDefault();
                }}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <Btn variant={p.hot ? 'primary' : 'ghost'} style={{ width: '100%' }}>
                  Buy {p.name} ↗
                </Btn>
              </a>
            </div>
          </Card>
        ))}
      </div>

      {/* Purchase flow hint + redeem */}
      <Card style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 12 }}>How to buy</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { step: '1', text: 'Click a Buy button above and complete payment in the store' },
                { step: '2', text: 'Once payment succeeds, your redemption code is shown' },
                { step: '3', text: 'Copy the code and paste it into the redeem box on the right' },
              ].map((s) => (
                <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.lime,
                    width: 24, height: 24, borderRadius: 999, border: `1px solid ${T.lime}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{s.step}</span>
                  <span style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.6 }}>{s.text}</span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(198,255,58,0.06)', border: `1px solid ${T.lime}20`,
              fontSize: 12, color: T.inkDim, lineHeight: 1.6,
            }}>
              Code format: <span style={{ fontFamily: T.mono, color: T.lime }}>XXXX-XXXX-XXXX-XXXX</span>. Codes are case-insensitive.
              Membership starts as soon as you redeem and lasts 30 days. Redeeming more codes extends it.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Redeem a code</div>
            <form onSubmit={redeem} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TrackInput
                mono
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                style={{ letterSpacing: 2, fontSize: 14 }}
              />
              <Btn type="submit" disabled={!code || busy}>
                {busy ? 'Redeeming…' : 'Redeem'}
              </Btn>
            </form>
          </div>
        </div>
      </Card>

      {/* Referral */}
      {refStats && refStats.referralCode && (
        <Card style={{ padding: 24, marginBottom: 28 }}>
          <CardHeader eyebrow="REFERRAL" title="Invite 2 friends, get a month of Max" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: T.inkDim, marginBottom: 8 }}>Your personal invite link</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{
                  flex: 1, fontFamily: T.mono, fontSize: 13, color: T.ink,
                  padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  userSelect: 'all',
                }}>
                  {`${typeof window !== 'undefined' ? window.location.origin : 'https://garmin-trainer.uk'}/sign-up?ref=${refStats.referralCode}`}
                </div>
                <Btn
                  variant="ghost"
                  size="sm"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    const link = `${window.location.origin}/sign-up?ref=${refStats.referralCode}`;
                    navigator.clipboard.writeText(link).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </Btn>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <Mini k="Invited" v={`${refStats.completedCount} / ${refStats.maxDays / 15} friends`} c={refStats.completedCount > 0 ? T.lime : T.inkFaint} />
              <Mini k="Earned" v={`${refStats.daysEarned} / ${refStats.maxDays} days of Max`} c={refStats.daysEarned > 0 ? T.lime : T.inkFaint} />
            </div>

            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(198,255,58,0.06)', border: `1px solid ${T.lime}20`,
              fontSize: 12, color: T.inkDim, lineHeight: 1.6,
            }}>
              For every friend who signs up with your link and verifies their email, you instantly earn <span style={{ color: T.lime, fontFamily: T.mono }}>15 days of Max</span>. Invite 2 friends for a full month (up to {refStats.maxDays} days in total).
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

function Mini({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.inkFaint, letterSpacing: 0.5 }}>{k}</div>
      <div style={{ fontFamily: T.mono, fontSize: 13, color: c, marginTop: 4, letterSpacing: 0.5 }}>{v}</div>
    </div>
  );
}
