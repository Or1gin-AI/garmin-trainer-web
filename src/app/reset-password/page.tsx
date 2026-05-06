'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

function humanizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid') && m.includes('token')) return '链接无效或已过期，请重新发起找回密码';
  if (m.includes('expired')) return '链接已过期，请重新发起找回密码';
  if (m.includes('short')) return '密码至少 8 位';
  return message;
}

function Inner() {
  const router = useRouter();
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
    if (err) {
      setError(humanizeError(err));
    }
    if (t) setToken(t);
  }, [params]);

  if (!token) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">
          {error || '链接缺少 token，请回到"找回密码"页面重新发起'}
        </p>
        <Link href="/forgot-password" className="text-sm text-emerald-600">
          重新发起找回密码
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-emerald-700">密码已重置，请用新密码登录。</p>
        <Link
          href="/sign-in"
          className="block text-center px-4 py-2 rounded-lg bg-emerald-600 text-white"
        >
          去登录
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    setLoading(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });
    setLoading(false);
    if (err) {
      setError(humanizeError(err.message ?? '重置失败'));
      return;
    }
    setDone(true);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 bg-white p-6 rounded-2xl border border-zinc-200"
    >
      <div>
        <label className="text-sm font-medium">新密码</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium">确认新密码</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700"
      >
        {loading ? '重置中…' : '重置密码'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">重置密码</h1>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500">加载中…</p>}>
          <Inner />
        </Suspense>
      </div>
    </main>
  );
}
