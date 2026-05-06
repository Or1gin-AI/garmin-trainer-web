'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface CodeRow {
  code: string;
  planDays: number;
  batchId: string | null;
  note: string | null;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function AdminPage() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [count, setCount] = useState(10);
  const [planDays, setPlanDays] = useState(30);
  const [prefix, setPrefix] = useState('');
  const [note, setNote] = useState('');
  const [generated, setGenerated] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [c, u] = await Promise.all([
      api.get<{ codes: CodeRow[] }>('/api/admin/codes'),
      api.get<{ users: UserRow[] }>('/api/admin/users'),
    ]);
    setCodes(c.codes);
    setUsers(u.users);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ codes: string[] }>('/api/admin/codes', {
        count,
        planDays,
        prefix: prefix || undefined,
        note: note || undefined,
      });
      setGenerated(r.codes);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function grantPro(userId: string) {
    const days = Number(prompt('授予多少天 Pro？', '30'));
    if (!days) return;
    try {
      await api.post('/api/admin/grant', { userId, planDays: days });
      alert('已授予');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold">管理后台</h1>
        <p className="text-zinc-500 mt-1">生成卡密、查看用户、手动授予 Pro。</p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">生成卡密</h2>
        <form onSubmit={generate} className="grid sm:grid-cols-4 gap-3">
          <Field label="数量">
            <input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>
          <Field label="天数">
            <input
              type="number"
              min={1}
              max={3650}
              value={planDays}
              onChange={(e) => setPlanDays(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>
          <Field label="前缀（可选）">
            <input
              value={prefix}
              onChange={(e) =>
                setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
              placeholder="例如 PRO"
              maxLength={8}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>
          <Field label="备注">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="sm:col-span-4 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
          >
            {busy ? '生成中…' : '生成'}
          </button>
        </form>
        {generated.length > 0 && (
          <div className="bg-zinc-900 text-emerald-300 rounded-lg p-4 font-mono text-xs space-y-1 max-h-64 overflow-auto">
            {generated.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">用户</h2>
        <table className="w-full text-sm">
          <thead className="text-zinc-500 text-left">
            <tr>
              <th className="font-normal py-2">邮箱</th>
              <th className="font-normal">昵称</th>
              <th className="font-normal">角色</th>
              <th className="font-normal">注册时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-100">
                <td className="py-2">{u.email}</td>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td className="text-zinc-500">
                  {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td>
                  <button
                    onClick={() => grantPro(u.id)}
                    className="text-emerald-600 hover:underline text-xs"
                  >
                    授予 Pro
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">最近卡密</h2>
        <table className="w-full text-xs font-mono">
          <thead className="text-zinc-500 text-left font-sans">
            <tr>
              <th className="font-normal py-2">卡密</th>
              <th className="font-normal">天数</th>
              <th className="font-normal">备注</th>
              <th className="font-normal">使用情况</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.code} className="border-t border-zinc-100">
                <td className="py-2">{c.code}</td>
                <td>{c.planDays}</td>
                <td>{c.note ?? '—'}</td>
                <td>
                  {c.usedBy ? (
                    <span className="text-zinc-500">
                      {new Date(c.usedAt!).toLocaleDateString('zh-CN')} · {c.usedBy.slice(0, 8)}
                    </span>
                  ) : (
                    <span className="text-emerald-600">未使用</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
