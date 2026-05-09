'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth-client';

type UsernameSignIn = {
  username: (body: {
    username: string;
    password: string;
  }) => Promise<{ error?: { message?: string } | null }>;
};

function humanizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && m.includes('password')) {
    return '账号或密码错误';
  }
  if (m.includes('not found') || m.includes('no user')) {
    return '账号不存在';
  }
  if (m.includes('unauthorized')) {
    return '账号或密码错误';
  }
  return message;
}

export default function SignInPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isEmail = identifier.includes('@');
    const { error: err } = isEmail
      ? await signIn.email({ email: identifier, password })
      : await (signIn as unknown as UsernameSignIn).username({
          username: identifier,
          password,
        });
    setLoading(false);
    if (err) {
      setError(humanizeError(err.message ?? '登录失败'));
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">登录</h1>
          <p className="text-sm text-zinc-500 mt-1">
            还没有账号？
            <Link href="/sign-up" className="text-emerald-600 ml-1">
              立即注册
            </Link>
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 bg-white p-6 rounded-2xl border border-zinc-200"
        >
          <div>
            <label className="text-sm font-medium">昵称或邮箱</label>
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
              placeholder="用户名 或 you@example.com"
              autoComplete="username"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">密码</label>
              <Link
                href="/forgot-password"
                className="text-xs text-zinc-500 hover:text-emerald-600"
              >
                忘记密码？
              </Link>
            </div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </main>
  );
}
