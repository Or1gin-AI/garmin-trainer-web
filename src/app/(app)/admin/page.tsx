'use client';

import { useEffect, useState } from 'react';
import {
  api,
  listLlmConfigs,
  createLlmConfig,
  updateLlmConfig,
  activateLlmConfig,
  deleteLlmConfig,
  listAiUsage,
  type LlmConfigSummary,
  type LlmConfigCreateBody,
  type LlmConfigUpdateBody,
  type AiUsageEntry,
} from '@/lib/api';

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

type TabKey = 'codes' | 'ai' | 'usage';

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>('codes');
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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">管理后台</h1>
        <p className="text-zinc-500 mt-1">生成卡密、查看用户、配置 AI 模型。</p>
      </header>

      <div className="flex gap-2 border-b border-zinc-200">
        <TabButton active={tab === 'codes'} onClick={() => setTab('codes')}>
          卡密 / 用户
        </TabButton>
        <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>
          AI 配置
        </TabButton>
        <TabButton active={tab === 'usage'} onClick={() => setTab('usage')}>
          用量
        </TabButton>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === 'codes' && (
        <div className="space-y-10">
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
                          {new Date(c.usedAt!).toLocaleDateString('zh-CN')} ·{' '}
                          {c.usedBy.slice(0, 8)}
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
      )}

      {tab === 'ai' && <AiConfigSection />}
      {tab === 'usage' && <AiUsageSection />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'px-4 py-2 -mb-px border-b-2 text-sm font-medium ' +
        (active
          ? 'border-emerald-600 text-emerald-700'
          : 'border-transparent text-zinc-500 hover:text-zinc-800')
      }
    >
      {children}
    </button>
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

// ===== AI config section =====

interface AiFormState {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  isActive: boolean;
}

const emptyAiForm: AiFormState = {
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  maxOutputTokens: 4096,
  isActive: false,
};

function AiConfigSection() {
  const [configs, setConfigs] = useState<LlmConfigSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<AiFormState>(emptyAiForm);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const list = await listLlmConfigs();
      setConfigs(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startCreate() {
    setEditingId('new');
    setForm({ ...emptyAiForm });
  }

  function startEdit(row: LlmConfigSummary) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      baseUrl: row.baseUrl,
      apiKey: '', // never prefilled
      model: row.model,
      maxOutputTokens: row.maxOutputTokens,
      isActive: row.isActive,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyAiForm);
  }

  function validate(isCreate: boolean): string | null {
    if (!form.name.trim() || form.name.length > 50) return '名称必填，最多 50 字符';
    if (!form.baseUrl.trim()) return 'Base URL 必填';
    try {
      const u = new URL(form.baseUrl);
      const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLocalhost)) {
        return 'Base URL 需为 https://（仅 localhost 允许 http://）';
      }
    } catch {
      return 'Base URL 格式无效';
    }
    if (isCreate && !form.apiKey) return '新增时 API Key 必填';
    if (form.apiKey.length > 200) return 'API Key 长度超出 200';
    if (!form.model.trim() || form.model.length > 100) return 'Model 必填，最多 100 字符';
    if (
      !Number.isInteger(form.maxOutputTokens) ||
      form.maxOutputTokens < 1 ||
      form.maxOutputTokens > 32768
    ) {
      return 'Max Output Tokens 范围 1–32768';
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    const isCreate = editingId === 'new';
    const errMsg = validate(isCreate);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isCreate) {
        const body: LlmConfigCreateBody = {
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey,
          model: form.model.trim(),
          maxOutputTokens: form.maxOutputTokens,
          isActive: form.isActive,
        };
        await createLlmConfig(body);
      } else {
        const body: LlmConfigUpdateBody = {
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          model: form.model.trim(),
          maxOutputTokens: form.maxOutputTokens,
          isActive: form.isActive,
        };
        if (form.apiKey) body.apiKey = form.apiKey;
        await updateLlmConfig(editingId as number, body);
      }
      cancelEdit();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: number) {
    setBusy(true);
    setError(null);
    try {
      await activateLlmConfig(id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: LlmConfigSummary) {
    if (row.isActive) return;
    if (!confirm(`删除 LLM 配置 “${row.name}”？此操作不可撤销。`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLlmConfig(row.id);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI 模型配置</h2>
          <button
            onClick={startCreate}
            disabled={busy || editingId !== null}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            新增
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">加载中…</p>
        ) : configs.length === 0 ? (
          <p className="text-sm text-zinc-500">尚未配置 LLM。点击“新增”添加。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="font-normal py-2">名称</th>
                  <th className="font-normal">Model</th>
                  <th className="font-normal">Base URL</th>
                  <th className="font-normal">API Key</th>
                  <th className="font-normal">Max Out</th>
                  <th className="font-normal">状态</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {configs.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      'border-t border-zinc-100 ' +
                      (row.isActive ? 'bg-emerald-50/40' : '')
                    }
                  >
                    <td className="py-2 font-medium">{row.name}</td>
                    <td className="font-mono text-xs">{row.model}</td>
                    <td className="font-mono text-xs text-zinc-600 max-w-[16rem] truncate">
                      {row.baseUrl}
                    </td>
                    <td className="font-mono text-xs text-zinc-500">{row.apiKeyHint}</td>
                    <td>{row.maxOutputTokens}</td>
                    <td>
                      {row.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                          激活中
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => startEdit(row)}
                        disabled={busy || editingId !== null}
                        className="text-emerald-600 hover:underline text-xs disabled:opacity-40"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => activate(row.id)}
                        disabled={busy || row.isActive || editingId !== null}
                        className="text-blue-600 hover:underline text-xs disabled:opacity-40"
                      >
                        激活
                      </button>
                      <button
                        onClick={() => remove(row)}
                        disabled={busy || row.isActive || editingId !== null}
                        className="text-red-600 hover:underline text-xs disabled:opacity-40"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingId !== null && (
        <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-semibold">
            {editingId === 'new' ? '新增配置' : `编辑：${form.name}`}
          </h3>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
            <Field label="名称">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={50}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </Field>
            <Field label="Model">
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                maxLength={100}
                placeholder="例如 gpt-4o-mini"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </Field>
            <Field label="Base URL">
              <input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </Field>
            <Field
              label={
                editingId === 'new'
                  ? 'API Key'
                  : 'API Key（留空则保留原值）'
              }
            >
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                maxLength={200}
                autoComplete="new-password"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                {...(editingId === 'new' ? { required: true } : {})}
              />
            </Field>
            <Field label="Max Output Tokens">
              <input
                type="number"
                min={1}
                max={32768}
                value={form.maxOutputTokens}
                onChange={(e) =>
                  setForm({ ...form, maxOutputTokens: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                required
              />
            </Field>
            <Field label="是否激活">
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                <span className="text-sm text-zinc-700">
                  保存后将其设为唯一激活配置
                </span>
              </label>
            </Field>
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
              >
                {busy ? '保存中…' : '保存'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 font-medium disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

// ===== AI usage section =====

function currentMonthIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function shiftMonth(period: string, delta: number): string {
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1; // 0-indexed
  const d = new Date(Date.UTC(y, m + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}-01`;
}

function AiUsageSection() {
  const [period, setPeriod] = useState<string>(currentMonthIso());
  const [entries, setEntries] = useState<AiUsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(p: string = period) {
    setLoading(true);
    setError(null);
    try {
      const r = await listAiUsage(p);
      setEntries(r.entries);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h2 className="text-lg font-semibold">AI 用量</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriod(shiftMonth(period, -1))}
              className="px-2 py-1 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              ←
            </button>
            <input
              type="month"
              value={period.slice(0, 7)}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}$/.test(v)) {
                  setPeriod(`${v}-01`);
                }
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => setPeriod(shiftMonth(period, 1))}
              className="px-2 py-1 rounded-lg border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              →
            </button>
            <button
              onClick={() => refresh(period)}
              disabled={loading}
              className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {loading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">加载中…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-zinc-500">本月暂无用量数据。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="font-normal py-2">用户</th>
                  <th className="font-normal">月份</th>
                  <th className="font-normal text-right">生成</th>
                  <th className="font-normal text-right">对话</th>
                  <th className="font-normal text-right">输入 tokens</th>
                  <th className="font-normal text-right">输出 tokens</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.userId} className="border-t border-zinc-100">
                    <td className="py-2">
                      <div className="font-medium text-zinc-800">{e.email}</div>
                      {e.displayName && (
                        <div className="text-xs text-zinc-500">{e.displayName}</div>
                      )}
                    </td>
                    <td className="text-zinc-500">{e.periodStart.slice(0, 7)}</td>
                    <td className="text-right tabular-nums">{e.planGenerationCount}</td>
                    <td className="text-right tabular-nums">{e.chatMessageCount}</td>
                    <td className="text-right tabular-nums">
                      {e.inputTokens.toLocaleString()}
                    </td>
                    <td className="text-right tabular-nums">
                      {e.outputTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
