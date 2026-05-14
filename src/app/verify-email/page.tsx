'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { authClient, useSession } from '@/lib/auth-client';
import { T, Btn, Banner } from '@/components/track';

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
      const t = setTimeout(() => router.push('/dashboard'), 1500);
      return () => clearTimeout(t);
    }
  }, [verified, session, router]);

  async function resend() {
    if (!email) return;
    setResending(true);
    setResent(false);
    await authClient.sendVerificationEmail({
      email,
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
        width: '100%', maxWidth: 420,
        background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: '36px 32px',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 8, background: T.lime,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.mono, fontWeight: 700, fontSize: 16, color: T.bg,
          boxShadow: `0 0 28px ${T.limeGlow}`, marginBottom: 18,
        }}>GT</div>

        {verified ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.green, letterSpacing: 1.5 }}>EMAIL.VERIFIED</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>邮箱已验证</h1>
            <Banner kind="ok" code="OK">
              {session ? '正在为你跳转到主页…' : '现在可以登录使用 Garmin Trainer。'}
            </Banner>
            {!session && (
              <Link href="/sign-in" style={{ textDecoration: 'none' }}>
                <Btn style={{ width: '100%' }}>去登录 →</Btn>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5 }}>VERIFY.PENDING</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>查收验证邮件</h1>
            <p style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.65, margin: 0 }}>
              我们已经向 {email
                ? <span style={{ fontFamily: T.mono, color: T.ink }}>{email}</span>
                : '你的邮箱'} 发送了验证邮件。点击邮件中的「验证邮箱」按钮即可完成注册。链接 1 小时内有效。
            </p>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 0.5, margin: 0 }}>
              // 没收到？检查垃圾邮件文件夹，或点击下方按钮重新发送。
            </p>
            {email && (
              <Btn
                variant="ghost"
                type="button"
                onClick={resend}
                disabled={resending || resent}
              >
                {resending ? '发送中…' : resent ? '✓ 已重新发送' : '重新发送验证邮件'}
              </Btn>
            )}
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Link href="/sign-in" className="track-link" style={{ fontSize: 13 }}>← 返回登录</Link>
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
