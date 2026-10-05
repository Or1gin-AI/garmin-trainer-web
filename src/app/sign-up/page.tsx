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
    return 'usernameAlready taken. Please choose another.';
  }
  if (m.includes('email') && (m.includes('exists') || m.includes('already') || m.includes('taken'))) {
    return 'That email is already registered. Sign in or reset your password.';
  }
  if (m.includes('username') && m.includes('invalid')) {
    return 'usernameUse letters, numbers, _ - ，2-30 ';
  }
  if (m.includes('password') && m.includes('short')) return 'Password must be at least 8 characters';
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
      setError('usernameUse letters, numbers, _ - ，2-30 ');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const { error: err } = await signUp.email({
      name: username,
      username,
      email,
      password,
      callbackURL: 'https://garmin-trainer.uk/verify-email?verified=1',
    } as never);
    setLoading(false);
    if (err) {
      setError(humanizeError(err.message ?? 'Sign-up failed'));
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
            A friend invited you to Garmin Trainer
          </div>
        )}

        {new Date() < PROMO_FREE_MAX_END && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(198,255,58,0.10)', border: `1px solid ${T.lime}50`,
            fontSize: 12, color: T.ink, lineHeight: 1.6,
          }}>
            <span style={{ color: T.lime, fontFamily: T.mono, letterSpacing: 0.5 }}>Limited-time offer · </span>
            Sign up to get Free <span style={{ color: T.lime, fontWeight: 700 }}>Max</span> membership through 2026-06-15
          </div>
        )}

        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Sign-up account</h1>
        <p style={{ fontSize: 13, color: T.inkDim, margin: '0 0 22px' }}>
          Already have an account?
          <Link href="/sign-in" className="track-link" style={{ marginLeft: 6 }}>Sign in</Link>
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="USERNAME">
            <TrackInput
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2-30  · letters / numbers / _ -"
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
                ! passwords do not match
              </div>
            )}
          </Field>

          {error && <Banner kind="error" code="ERR">{error}</Banner>}

          <Btn type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Creating account…' : 'Create account →'}
          </Btn>
        </form>
      </div>
    </main>
  );
}
