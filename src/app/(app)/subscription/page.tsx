'use client';

import { useEffect, useState } from 'react';
import { api, type MeResponse } from '@/lib/api';
import {
  T, Btn, Card, CardHeader, PageHero, Banner, TrackInput,
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

const PLANS: { name: string; label: string; price: string; d: string; hot?: boolean }[] = [
  { name: 'MONTH', label: '月卡', price: '¥29', d: '30 天 · 自动同步' },
  { name: 'QUARTER', label: '季卡', price: '¥79', d: '90 天 · 历史回填' },
  { name: 'YEAR', label: '年卡', price: '¥259', d: '365 天 · 推荐', hot: true },
];

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

  const isPro = me?.plan.isProActive ?? false;
  const proDays = isPro ? daysUntil(me?.plan.expiresAt ?? null) : null;
  const autoSync = me?.plan.autoSyncEnabled ?? false;

  return (
    <>
      <PageHero
        eyebrow="// SUB.TIER"
        title="订阅"
        sub="使用卡密激活或续期 Pro 会员。Pro 解锁每 2 小时自动同步、历史全量回填、AI 教练对话与训练计划生成。"
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

      <Card hot={isPro} glow={isPro} style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: isPro ? T.lime : T.inkFaint, letterSpacing: 1.5 }}>// CURRENT.PLAN</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1, color: isPro ? T.lime : T.ink }}>
                {isPro ? 'PRO' : 'FREE'}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, letterSpacing: 1 }}>
                {isPro ? (
                  <>EXPIRES {fmtDate(me?.plan.expiresAt ?? null)}{proDays != null && <> · <span style={{ color: T.amber }}>{proDays}D</span></>}</>
                ) : (
                  <>手动同步 · 升级解锁全部功能</>
                )}
              </span>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Mini k="AUTO.SYNC" v={isPro && autoSync ? 'ON' : 'OFF'} c={isPro && autoSync ? T.lime : T.inkFaint} />
              <Mini k="REGIONS" v="CN + INTL" c={T.ink} />
              <Mini k="ACCOUNT" v={me?.user.email ?? '—'} c={T.ink} />
            </div>
          </div>
          {isPro && (
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
                AUTO.SYNC · 每 2 小时
              </span>
            </label>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 14, marginBottom: 28 }}>
        <Card style={{ padding: 22 }}>
          <CardHeader eyebrow="// PURCHASE" title="购买卡密" />
          <p style={{ marginTop: 12, fontSize: 13, color: T.inkDim, lineHeight: 1.65 }}>
            在新标签页打开购买页，完成支付后会显示一串卡密
            <span style={{ fontFamily: T.mono, color: T.lime, margin: '0 6px' }}>XXXX-XXXX-XXXX-XXXX</span>。
            填写邮箱后卡密会发送到邮箱留底；建议立即复制并兑换。
          </p>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {PLANS.map((p) => (
              <div key={p.name} style={{
                padding: 14, borderRadius: 8,
                border: `1px solid ${p.hot ? T.lime : T.border}`,
                background: p.hot ? T.limeGlow : 'rgba(255,255,255,0.02)',
                position: 'relative',
              }}>
                {p.hot && (
                  <div style={{
                    position: 'absolute', top: -8, right: 10, fontFamily: T.mono, fontSize: 9, letterSpacing: 1.5,
                    color: T.bg, background: T.lime, padding: '2px 6px', borderRadius: 3, fontWeight: 700,
                  }}>BEST</div>
                )}
                <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, color: p.hot ? T.lime : T.inkFaint }}>{p.name}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: T.ink }}>{p.price}</div>
                <div style={{ fontSize: 11, color: T.inkDim, marginTop: 4 }}>{p.d}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <a href="https://pay.ldxp.cn/item/3xvbsa" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Btn>前往购买 ↗</Btn>
            </a>
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <CardHeader eyebrow="// REDEEM" title="兑换卡密" />
          <form onSubmit={redeem} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TrackInput
              mono
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              style={{ letterSpacing: 2, fontSize: 14 }}
            />
            <Btn type="submit" disabled={!code || busy}>
              {busy ? '兑换中…' : '兑换 →'}
            </Btn>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1, marginTop: 4 }}>
              卡密由 16 位字母数字组成，不区分大小写。
            </div>
          </form>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 8 }}>
              // PRO.PERKS
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: T.inkDim }}>
              {[
                '每 2 小时自动同步新增运动记录',
                '历史活动全量回填',
                '同步失败自动重试 + 优先排队',
                'AI 教练对话与训练计划生成',
              ].map((p, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ color: T.lime, fontFamily: T.mono }}>+</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}

function Mini({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5 }}>{k}</div>
      <div style={{ fontFamily: T.mono, fontSize: 13, color: c, marginTop: 4, letterSpacing: 0.5 }}>{v}</div>
    </div>
  );
}
