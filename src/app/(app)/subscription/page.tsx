'use client';

import { useEffect, useState } from 'react';
import { api, type MeResponse, type ReferralStats } from '@/lib/api';
import {
  T, Btn, Card, CardHeader, PageHero, Banner, TrackInput, PlusBadge,
} from '@/components/track';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('zh-CN');
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
    period: '/月',
    desc: 'Garmin 数据自动同步',
    features: [
      '每 2 小时自动同步运动记录',
      '历史活动全量回填',
      '同步失败自动重试',
      '支持国区 + 国际区',
    ],
    href: PAY_URLS.pro,
  },
  {
    name: 'MAX',
    price: '¥15',
    period: '/月',
    desc: 'AI 训练计划 + 全部同步能力',
    features: [
      '包含 Plus 全部同步功能',
      'AI 生成个性化周训练计划',
      'AI 教练对话、改课、答疑',
      '训练计划导出（PDF / Word / Excel）',
      '一键推送计划到 Garmin 日历',
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
      setSuccess(`兑换成功，已激活 ${redeemedPlanLabel(r.subscriptionPlan)}，到期时间 ${fmtDate(r.expiresAt)}`);
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
      `即将跳转到链动小铺购买 ${planName} 会员。支付完成后请复制卡密，回到本站订阅页兑换。是否继续？`,
    );
  }

  const activePlan = me?.plan.plan ?? 'free';
  const isPaid = activePlan !== 'free';
  const planDays = isPaid ? daysUntil(me?.plan.expiresAt ?? null) : null;
  const canAutoSync = me?.plan.canAutoSync ?? false;
  const canUseAi = me?.plan.canUseAi ?? false;
  const autoSync = me?.plan.autoSyncEnabled ?? false;

  return (
    <>
      <PageHero
        title="订阅"
        sub="选择适合你的方案，解锁自动同步或 AI 训练教练。"
      />

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
                  <>到期 {fmtDate(me?.plan.expiresAt ?? null)}{planDays != null && <> · <span style={{ color: T.amber }}>剩余 {planDays} 天</span></>}</>
                ) : (
                  '免费版 · 仅支持手动同步'
                )}
              </span>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Mini k="自动同步" v={canAutoSync && autoSync ? '已开启' : 'Plus'} c={canAutoSync && autoSync ? T.lime : T.amber} />
              <Mini k="AI 教练" v={canUseAi ? '已解锁' : '仅 Max'} c={canUseAi ? T.lime : T.inkFaint} />
              <Mini k="区域" v="国区 + 国际区" c={T.ink} />
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
                自动同步 · 每 2 小时
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
                {p.name === 'PLUS' && <PlusBadge />}
                {p.hot && (
                  <span style={{
                    fontFamily: T.mono, fontSize: 9, letterSpacing: 1.5,
                    color: T.bg, background: T.lime, padding: '2px 8px', borderRadius: 3, fontWeight: 700,
                  }}>推荐</span>
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
                  购买 {p.name} ↗
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
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 12 }}>如何购买</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { step: '1', text: '点击上方购买按钮，跳转到链动小铺完成支付' },
                { step: '2', text: '支付成功后页面会显示一串卡密' },
                { step: '3', text: '复制卡密，回到本页右侧粘贴兑换' },
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
              卡密格式：<span style={{ fontFamily: T.mono, color: T.lime }}>XXXX-XXXX-XXXX-XXXX</span>，不区分大小写。
              兑换后会员立即生效，有效期 30 天。重复兑换会叠加时长。
            </div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 12 }}>兑换卡密</div>
            <form onSubmit={redeem} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TrackInput
                mono
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                style={{ letterSpacing: 2, fontSize: 14 }}
              />
              <Btn type="submit" disabled={!code || busy}>
                {busy ? '兑换中…' : '兑换'}
              </Btn>
            </form>
          </div>
        </div>
      </Card>

      {/* Referral */}
      {refStats && refStats.referralCode && (
        <Card style={{ padding: 24, marginBottom: 28 }}>
          <CardHeader eyebrow="REFERRAL" title="邀请好友" />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: T.inkDim, marginBottom: 8 }}>你的专属邀请链接</div>
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
                  {copied ? '已复制' : '复制链接'}
                </Btn>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <Mini k="已邀请" v={`${refStats.completedCount} / ${refStats.maxDays / 15} 人`} c={refStats.completedCount > 0 ? T.lime : T.inkFaint} />
              <Mini k="已获得" v={`${refStats.daysEarned} / ${refStats.maxDays} 天 Max`} c={refStats.daysEarned > 0 ? T.lime : T.inkFaint} />
            </div>

            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(198,255,58,0.06)', border: `1px solid ${T.lime}20`,
              fontSize: 12, color: T.inkDim, lineHeight: 1.6,
            }}>
              每成功推荐一位好友注册并验证邮箱，你将获得 <span style={{ color: T.lime, fontFamily: T.mono }}>15 天 Max</span> 会员，最多累计 {refStats.maxDays} 天。
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
