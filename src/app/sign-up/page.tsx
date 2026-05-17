'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUp } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { T, Btn, Field, Banner, TrackInput, BrandIcon } from '@/components/track';

const NAME_RE = /^[\p{L}\p{N}_-]{2,30}$/u;
const PROMO_FREE_MAX_END = new Date('2026-06-15T23:59:59Z');

function humanizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('username') && (m.includes('taken') || m.includes('exists') || m.includes('already'))) {
    return '昵称已被占用，请换一个';
  }
  if (m.includes('email') && (m.includes('exists') || m.includes('already') || m.includes('taken'))) {
    return '该邮箱已注册，请直接登录或找回密码';
  }
  if (m.includes('username') && m.includes('invalid')) {
    return '昵称只能用中英文 / 数字 / _ - ，2-30 位';
  }
  if (m.includes('password') && m.includes('short')) return '密码至少 8 位';
  return message;
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!NAME_RE.test(username)) {
      setError('昵称只能用中英文 / 数字 / _ - ，2-30 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }

    setLoading(true);
    const { error: err } = await signUp.email({
      name: username,
      username,
      email,
      password,
      callbackURL: `${window.location.origin}/verify-email?verified=1`,
    } as never);
    setLoading(false);
    if (err) {
      setError(humanizeError(err.message ?? '注册失败'));
      return;
    }
    if (ref) {
      await api
        .post('/api/referral/register-intent', { email, referralCode: ref })
        .catch(() => {});
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <main className="track-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: '36px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <BrandIcon size={52} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Garmin Trainer</span>
        </div>

        {ref && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(198,255,58,0.08)', border: `1px solid ${T.lime}30`,
            fontSize: 12, color: T.lime, fontFamily: T.mono, letterSpacing: 0.5,
          }}>
            你被好友邀请加入 Garmin Trainer
          </div>
        )}

        {new Date() < PROMO_FREE_MAX_END && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(198,255,58,0.10)', border: `1px solid ${T.lime}50`,
            fontSize: 12, color: T.ink, lineHeight: 1.6,
          }}>
            <span style={{ color: T.lime, fontFamily: T.mono, letterSpacing: 0.5 }}>限时活动 · </span>
            注册即享免费 <span style={{ color: T.lime, fontWeight: 700 }}>Max</span> 会员至 2026-06-15
          </div>
        )}

        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>注册账号</h1>
        <p style={{ fontSize: 13, color: T.inkDim, margin: '0 0 22px' }}>
          已有账号？
          <Link href="/sign-in" className="track-link" style={{ marginLeft: 6 }}>直接登录</Link>
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="USERNAME">
            <TrackInput
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2-30 位 · 中英文 / 数字 / _ -"
            />
          </Field>

          <Field label="EMAIL">
            <TrackInput
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="PASSWORD" hint={<span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1 }}>MIN 8 CHARS</span>}>
            <TrackInput
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Field label="CONFIRM.PASSWORD">
            <TrackInput
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && password !== confirm && (
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.red, letterSpacing: 1, marginTop: 4 }}>
                ! 密码不一致
              </div>
            )}
          </Field>

          {error && <Banner kind="error" code="ERR">{error}</Banner>}

          <Btn type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? '注册中…' : '创建账号 →'}
          </Btn>
        </form>
      </div>
    </main>
  );
}
