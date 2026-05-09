'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/auth-client';

const NAME_RE = /^[\p{L}\p{N}_-]{2,30}$/u;

function humanizeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('username') && (m.includes('taken') || m.includes('exists') || m.includes('already'))) {
    return '昵称已被占用，请换一个';
  }
  if (m.includes('email') && (m.includes('exists') || m.includes('already') || m.includes('taken'))) {
    return '该邮箱已注册，请直接登录或找回密码';
  }
  if (m.includes('username') && m.includes('invalid')) {
    return '昵称只能用中英文 / 数字 / _ - ，2-30 位';
  }
  if (m.includes('password') && m.includes('short')) {
    return '密码至少 8 位';
  }
  return message;
}

export default function SignUpPage() {
  const router = useRouter();
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
      setError('昵称只能用中英文 / 数字 / _ - ，2-30 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }

    setLoading(true);
    const { error: err } = await signUp.email({
      name: username,
      username,
      email,
      password,
      callbackURL: `${window.location.origin}/verify-email?verified=1`,
    } as never);
    setLoading(false);
    if (err) {
      setError(humanizeError(err.message ?? '注册失败'));
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
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
          <h1 className="text-2xl font-bold">注册账号</h1>
          <p className="text-sm text-zinc-500 mt-1">
            已有账号？
            <Link href="/sign-in" className="text-emerald-600 ml-1">
              直接登录
            </Link>
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 bg-white p-6 rounded-2xl border border-zinc-200"
        >
          <div>
            <label className="text-sm font-medium">昵称</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
              placeholder="2-30 位，可用中英文 / 数字 / _ -"
            />
          </div>
          <div>
            <label className="text-sm font-medium">邮箱</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium">密码</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-zinc-500 mt-1">至少 8 位</p>
          </div>
          <div>
            <label className="text-sm font-medium">确认密码</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500"
            />
            {confirm && password !== confirm && (
              <p className="text-xs text-red-600 mt-1">两次密码不一致</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700"
          >
            {loading ? '注册中…' : '创建账号'}
          </button>
        </form>
      </div>
    </main>
  );
}
