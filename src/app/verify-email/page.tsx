'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { authClient, useSession } from '@/lib/auth-client';
import { T, Btn, Banner, BrandIcon } from '@/components/track';

function VerifyEmailInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const verified = params.get('verified') === '1';
  const email = params.get('email') ?? '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (verified && session) {
      const t = setTimeout(() => router.push('/garmin'), 1500);
      return () => clearTimeout(t);
    }
  }, [verified, session, router]);

  async function resend() {
    if (!email) return;
    setResending(true);
    setResent(false);
    await authClient.sendVerificationEmail({
      email,
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
        width: '100%', maxWidth: 420,
        background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: '36px 32px',
      }}>
        <BrandIcon size={52} style={{ marginBottom: 18 }} />

        {verified ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.green, letterSpacing: 1.5 }}>EMAIL.VERIFIED</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Email verified</h1>
            <Banner kind="ok" code="OK">
              {session ? 'Taking you to the dashboard…' : 'You can now sign in to Garmin Trainer.'}
            </Banner>
            {!session && (
              <Link href="/sign-in" style={{ textDecoration: 'none' }}>
                <Btn style={{ width: '100%' }}>Go to sign in →</Btn>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5 }}>VERIFY.PENDING</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>Check your email</h1>
            <p style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.65, margin: 0 }}>
              We sent a {email
                ? <span style={{ fontFamily: T.mono, color: T.ink }}>{email}</span>
                : 'your email'} We sent a verification email. Click “Verify email” in the message to complete sign-up. The link is valid for one hour.
            </p>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 0.5, margin: 0 }}>
              {'// Did not receive it? Check your spam folder or resend it below.'}
            </p>
            {email && (
              <Btn
                variant="ghost"
                type="button"
                onClick={resend}
                disabled={resending || resent}
              >
                {resending ? 'Sending…' : resent ? '✓ Resent' : 'Resend verification email'}
              </Btn>
            )}
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Link href="/sign-in" className="track-link" style={{ fontSize: 13 }}>← Back to sign in</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="track-page" style={{ minHeight: '100vh' }} />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
