'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { T, Btn, Field, Banner, TrackInput } from '@/components/track';

function humanizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && m.includes('token')) return 'This link is invalid or expired. Request a new password reset.';
  if (m.includes('expired')) return 'This link has expired. Request a new password reset.';
  if (m.includes('short')) return 'Password must be at least 8 characters';
  return message;
}

function Inner() {
  const params = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = params.get('token');
    const err = params.get('error');
    if (err) setError(humanizeError(err));
    if (t) setToken(t);
  }, [params]);

  if (!token) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Banner kind="error" code="ERR">
          {error || 'This link is missing a token. Return to the password reset page and try again.'}
        </Banner>
        <div style={{ textAlign: 'center' }}>
          <Link href="/forgot-password" className="track-link" style={{ fontSize: 13 }}>
            Request a new password reset →
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Banner kind="ok" code="DONE">Password reset. Sign in with your new password.</Banner>
        <Link href="/sign-in" style={{ textDecoration: 'none' }}>
          <Btn style={{ width: '100%' }}>Go to sign in →</Btn>
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });
    setLoading(false);
    if (err) {
      setError(humanizeError(err.message ?? 'Reset failed'));
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="NEW.PASSWORD">
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
      </Field>
      {error && <Banner kind="error" code="ERR">{error}</Banner>}
      <Btn type="submit" disabled={loading}>
        {loading ? 'Resetting…' : 'Reset password →'}
      </Btn>
    </form>
  );
}

export default function ResetPasswordPage() {
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
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5 }}>PWD.RESET</div>
        <h1 style={{ margin: '6px 0 22px', fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>
          Reset password
        </h1>
        <Suspense fallback={<div className="track-blink" style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }}>LOADING…</div>}>
          <Inner />
        </Suspense>
      </div>
    </main>
  );
}
