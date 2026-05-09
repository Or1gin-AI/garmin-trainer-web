'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';

const NAV = [
  { href: '/dashboard', label: '同步' },
  { href: '/training', label: '训练' },
  { href: '/garmin', label: 'Garmin 账号' },
  { href: '/subscription', label: '订阅' },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/sign-in');
    }
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-400">
        载入中…
      </main>
    );
  }

  const role = (session.user as { role?: string }).role;
  const nav = role === 'admin' ? [...NAV, { href: '/admin', label: '管理后台' }] : NAV;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <Image
              src="/logo.jpg"
              alt="Garmin Trainer"
              width={44}
              height={44}
              priority
              className="rounded-lg"
            />
            <span>Garmin Trainer</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    active
                      ? 'bg-zinc-900 text-white'
                      : 'hover:bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500 hidden sm:inline">
              {session.user.email}
            </span>
            <button
              onClick={async () => {
                await signOut();
                router.push('/sign-in');
              }}
              className="text-zinc-500 hover:text-zinc-900"
            >
              退出
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
