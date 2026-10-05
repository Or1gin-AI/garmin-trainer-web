'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { T, Btn, Field, Banner, TrackInput } from '@/components/track';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetCallback =
    typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : '/reset-password';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error: err } = await authClient.requestPasswordReset({
      email,
      redirectTo: resetCallback,
    });
    setLoading(false);
    if (err) console.warn('requestPasswordReset:', err);
    setDone(true);
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
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5 }}>PWD.RESET</div>
        <h1 style={{ margin: '6px 0 6px', fontSize: 24, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Reset password</h1>
        <p style={{ fontSize: 13, color: T.inkDim, margin: '0 0 22px' }}>
          Remembered it?
          <Link href="/sign-in" className="track-link" style={{ marginLeft: 6 }}>Back to sign in</Link>
        </p>

        {done ? (
          <>
            <Banner kind="ok" code="SENT">
              If that email is registered, we sent a password-reset email. Check your inbox and spam folder. The link is valid for one hour.
            </Banner>
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <Link href="/sign-in" className="track-link" style={{ fontSize: 13 }}>← Back to sign in</Link>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="EMAIL">
              <TrackInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Btn type="submit" disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send reset email →'}
            </Btn>
          </form>
        )}
      </div>
    </main>
  );
}
