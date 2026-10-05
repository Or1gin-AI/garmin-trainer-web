'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, authClient } from '@/lib/auth-client';
import { T, Btn, Field, Banner, TrackInput, BrandIcon } from '@/components/track';

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
  if (m.includes('invalid') && m.includes('password')) return 'Accountor password is incorrect';
  if (m.includes('not found') || m.includes('no user')) return 'Account not found';
  if (m.includes('unauthorized')) return 'Accountor password is incorrect';
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
      setError(humanizeError(err.message ?? 'Sign inFailed'));
      return;
    }
    router.push('/garmin');
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    setResending(true);
    await authClient.sendVerificationEmail({
      email: unverifiedEmail,
      callbackURL: 'https://garmin-trainer.uk/verify-email?verified=1',
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
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32, minHeight: 480,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <BrandIcon size={76} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 20, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Garmin Trainer</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.1, margin: '24px 0 14px', color: T.ink }}>
              Your AI coachis ready
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '⌚', title: 'Automatic Garmin data sync', desc: 'Automatically pull your activities from CN and International accounts' },
              { icon: '🧠', title: 'AI personalized training plans', desc: 'AI builds a weekly plan from your Garmin data' },
              { icon: '💬', title: 'AI personal coach', desc: 'Understand your real fitness status, chat, ask questions, and adjust workouts' },
              { icon: '📊', title: 'One-click export and publishing', desc: 'Export PDF / Excel or publish directly to Garmin Calendar' },
            ].map((f) => (
              <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: T.inkDim, marginTop: 3, lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
          <h2 style={{ margin: '0', fontSize: 22, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>Sign in</h2>

          <Field label="USERNAME / EMAIL">
            <TrackInput
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="username · you@example.com"
              autoComplete="username"
            />
          </Field>

          <Field
            label="PASSWORD"
            hint={
              <Link href="/forgot-password" className="track-link" style={{ fontSize: 11 }}>
                Forgot password?
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
              This email is not verified.
              {resent ? (
                <span style={{ color: T.green, marginLeft: 6 }}>Verification email resent.</span>
              ) : (
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={resending}
                  className="track-link"
                  style={{ background: 'transparent', border: 'none', padding: 0, marginLeft: 6, fontSize: 13 }}
                >
                  {resending ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
            </Banner>
          )}

          <Btn type="submit" disabled={loading || !identifier || !password} style={{ marginTop: 6 }}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </Btn>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: T.inkFaint, fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ fontFamily: T.mono, letterSpacing: 1.5, fontSize: 10 }}>OR</span>
            <span style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          <p style={{ fontSize: 13, color: T.inkDim, margin: 0, textAlign: 'center' }}>
            Don’t have an account?
            <Link href="/sign-up" className="track-link" style={{ marginLeft: 6 }}>Sign up now</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
