'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetCallback =
    typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : '/reset-password';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await authClient.requestPasswordReset({
      email,
      redirectTo: resetCallback,
    });
    setLoading(false);
    if (err) {
      // Don't leak whether the email exists. Show success regardless,
      // but log the original error for ourselves.
      console.warn('requestPasswordReset:', err);
    }
    setDone(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">找回密码</h1>
          <p className="text-sm text-zinc-500 mt-1">
            想起来了？
            <Link href="/sign-in" className="text-emerald-600 ml-1">
              返回登录
            </Link>
          </p>
        </div>

        {done ? (
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-3">
            <p className="text-sm text-zinc-700 leading-relaxed">
              如果该邮箱在我们这里注册过，我们已经发送了一封重置密码的邮件，请查收（包括垃圾邮件文件夹）。链接 1 小时内有效。
            </p>
            <Link
              href="/sign-in"
              className="block text-center text-sm text-emerald-600"
            >
              回到登录
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-4 bg-white p-6 rounded-2xl border border-zinc-200"
          >
            <div>
              <label className="text-sm font-medium">注册邮箱</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700"
            >
              {loading ? '发送中…' : '发送重置邮件'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
