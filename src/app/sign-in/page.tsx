'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, authClient } from '@/lib/auth-client';
import { T, Btn, Field, Banner, TrackInput } from '@/components/track';

type SignInError = { message?: string; status?: number; code?: string } | null | undefined;

type UsernameSignIn = {
  username: (body: {
    username: string;
    password: string;
  }) => Promise<{ error?: SignInError }>;
};

function isEmailNotVerified(err: SignInError): boolean {
  if (!err) return false;
  if (err.code === 'EMAIL_NOT_VERIFIED') return true;
  const m = (err.message || '').toLowerCase();
  return m.includes('email') && m.includes('verif');
}

function humanizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && m.includes('password')) return '账号或密码错误';
  if (m.includes('not found') || m.includes('no user')) return '账号不存在';
  if (m.includes('unauthorized')) return '账号或密码错误';
  return message;
}

export default function SignInPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUnverifiedEmail(null);
    setResent(false);

    const isEmail = identifier.includes('@');
    const { error: err } = isEmail
      ? await signIn.email({ email: identifier, password })
      : await (signIn as unknown as UsernameSignIn).username({ username: identifier, password });
    setLoading(false);
    if (err) {
      if (isEmailNotVerified(err) && isEmail) {
        setUnverifiedEmail(identifier);
        return;
      }
      setError(humanizeError(err.message ?? '登录失败'));
      return;
    }
    router.push('/dashboard');
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    setResending(true);
    await authClient.sendVerificationEmail({
      email: unverifiedEmail,
      callbackURL: `${window.location.origin}/verify-email?verified=1`,
    });
    setResending(false);
    setResent(true);
  }

  return (
    <main className="track-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 880,
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 0,
        background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{
          padding: '40px 36px', borderRight: `1px solid ${T.border}`,
          background: `radial-gradient(circle at 20% 0%, ${T.limeGlow}, transparent 60%)`,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 480,
        }}>
          <div>
            <div style={{
              width: 44, height: 44, borderRadius: 8, background: T.lime,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.mono, fontWeight: 700, fontSize: 16, color: T.bg,
              boxShadow: `0 0 28px ${T.limeGlow}`,
            }}>GT</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, marginTop: 28 }}>
              GARMIN_TRAINER
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.1, margin: '8px 0 14px', color: T.ink }}>
              你的 AI 教练已就位
            </h1>
            <p style={{ color: T.inkDim, fontSize: 14, lineHeight: 1.65, margin: 0, maxWidth: 320 }}>
              连接 Garmin · 自动同步活动 · 让 AI 根据你的真实状态生成下一周训练。
            </p>
          </div>
          <div style={{
            fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1.2, lineHeight: 1.8,
            borderTop: `1px solid ${T.border}`, paddingTop: 16,
          }}>
            <div>SYS.STAT &nbsp; <span style={{ color: T.green }}>● ALL.GREEN</span></div>
            <div>REGIONS &nbsp; <span style={{ color: T.ink }}>CN + INTL</span></div>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5 }}>AUTH</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>登录</h2>
          </div>

          <Field label="USERNAME / EMAIL">
            <TrackInput
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="用户名 · you@example.com"
              autoComplete="username"
            />
          </Field>

          <Field
            label="PASSWORD"
            hint={
              <Link href="/forgot-password" className="track-link" style={{ fontSize: 11 }}>
                忘记密码？
              </Link>
            }
          >
            <TrackInput
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          {error && <Banner kind="error" code="ERR">{error}</Banner>}

          {unverifiedEmail && (
            <Banner kind="warn" code="UNVERIFIED">
              该邮箱尚未验证。
              {resent ? (
                <span style={{ color: T.green, marginLeft: 6 }}>验证邮件已重新发送。</span>
              ) : (
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={resending}
                  className="track-link"
                  style={{ background: 'transparent', border: 'none', padding: 0, marginLeft: 6, fontSize: 13 }}
                >
                  {resending ? '发送中…' : '重新发送验证邮件'}
                </button>
              )}
            </Banner>
          )}

          <Btn type="submit" disabled={loading || !identifier || !password} style={{ marginTop: 6 }}>
            {loading ? '验证中…' : '登录 →'}
          </Btn>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: T.inkFaint, fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ fontFamily: T.mono, letterSpacing: 1.5, fontSize: 10 }}>OR</span>
            <span style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          <p style={{ fontSize: 13, color: T.inkDim, margin: 0, textAlign: 'center' }}>
            还没有账号？
            <Link href="/sign-up" className="track-link" style={{ marginLeft: 6 }}>立即注册</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
