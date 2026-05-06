import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="inline-block px-3 py-1 text-xs uppercase tracking-widest rounded-full bg-emerald-100 text-emerald-800">
          Garmin CN → Global
        </div>
        <h1 className="text-5xl font-bold tracking-tight">
          国区运动记录，自动同步到国际区
        </h1>
        <p className="text-lg text-zinc-600 leading-relaxed">
          注册账号、绑定两区 Garmin、按需同步。Pro 用户每 2 小时自动同步一次新记录。
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/sign-up"
            className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
          >
            注册账号
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 rounded-lg border border-zinc-300 hover:border-zinc-400 transition"
          >
            登录
          </Link>
        </div>
      </div>
    </main>
  );
}
