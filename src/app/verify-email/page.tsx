'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { authClient, useSession } from '@/lib/auth-client';

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
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Image
            src="/logo.jpg"
            alt="Garmin Trainer"
            width={72}
            height={72}
            priority
            className="mx-auto rounded-2xl mb-4"
          />
        </div>

        {verified ? (
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl">
              ✓
            </div>
            <h1 className="text-xl font-semibold">邮箱已验证</h1>
            <p className="text-sm text-zinc-600">
              {session ? '正在为你跳转到主页…' : '现在可以登录使用 Garmin Trainer。'}
            </p>
            {!session && (
              <Link
                href="/sign-in"
                className="inline-block w-full py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                去登录
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
            <h1 className="text-xl font-semibold text-center">查收验证邮件</h1>
            <p className="text-sm text-zinc-700 leading-relaxed">
              我们已经向 {email ? <span className="font-medium">{email}</span> : '你的邮箱'} 发送了一封验证邮件。
              点击邮件中的"验证邮箱"按钮即可完成注册。链接 1 小时内有效。
            </p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              没收到？可能在垃圾邮件文件夹。也可以点下方按钮重新发送。
            </p>
            {email && (
              <button
                type="button"
                onClick={resend}
                disabled={resending || resent}
                className="w-full py-2 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {resending ? '发送中…' : resent ? '已重新发送' : '重新发送验证邮件'}
              </button>
            )}
            <Link
              href="/sign-in"
              className="block text-center text-sm text-emerald-600"
            >
              返回登录
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
