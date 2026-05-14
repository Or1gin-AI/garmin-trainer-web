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
import {
  T,
  Btn,
  Card,
  CardHeader,
  Field,
  PageHero,
  Banner,
  TrackInput,
  TrackSelect,
  SectionLabel,
} from '@/components/track';

interface CodeRow {
  code: string;
  plan: 'pro' | 'max';
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
  const [plan, setPlan] = useState<'pro' | 'max'>('max');
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
        plan,
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

  async function grantMax(userId: string) {
    const days = Number(prompt('授予多少天 Max？', '30'));
    if (!days) return;
    try {
      await api.post('/api/admin/grant', { userId, plan: 'max', planDays: days });
      alert('已授予');
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="track-page" style={{ minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: T.pageMaxW, margin: '0 auto' }}>
        <PageHero
          eyebrow="ADMIN.CONSOLE"
          title="管理后台"
          sub="生成卡密 · 管理用户 · 配置 AI 模型 · 查看用量"
        />

        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <TabButton active={tab === 'codes'} onClick={() => setTab('codes')} code="CODES">
            卡密 / 用户
          </TabButton>
          <TabButton active={tab === 'ai'} onClick={() => setTab('ai')} code="AI.CFG">
            AI 配置
          </TabButton>
          <TabButton active={tab === 'usage'} onClick={() => setTab('usage')} code="USAGE">
            用量
          </TabButton>
        </div>

        {error && (
          <div style={{ marginBottom: 20 }}>
            <Banner kind="error" code="ERR">{error}</Banner>
          </div>
        )}

        {tab === 'codes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card style={{ padding: 24 }}>
              <CardHeader eyebrow="CODES.GENERATE" title="生成卡密" />
              <form
                onSubmit={generate}
                style={{
                  marginTop: 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: 14,
                }}
              >
                <Field label="COUNT">
                  <TrackInput
                    type="number"
                    min={1}
                    max={1000}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </Field>
                <Field label="PLAN">
                  <TrackSelect
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as 'pro' | 'max')}
                  >
                    <option value="max">MAX · AI + SYNC</option>
                    <option value="pro">PRO · SYNC ONLY</option>
                  </TrackSelect>
                </Field>
                <Field label="PLAN.DAYS">
                  <TrackInput
                    type="number"
                    min={1}
                    max={3650}
                    value={planDays}
                    onChange={(e) => setPlanDays(Number(e.target.value))}
                  />
                </Field>
                <Field label="PREFIX">
                  <TrackInput
                    mono
                    value={prefix}
                    onChange={(e) =>
                      setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    placeholder={plan.toUpperCase()}
                    maxLength={8}
                  />
                </Field>
                <Field label="NOTE">
                  <TrackInput
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="可选"
                  />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Btn type="submit" disabled={busy}>
                    {busy ? '生成中…' : '生成卡密 →'}
                  </Btn>
                </div>
              </form>

              {generated.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <SectionLabel right={
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.2 }}>
                      {generated.length} GENERATED
                    </span>
                  }>OUTPUT</SectionLabel>
                  <div style={{
                    background: '#0a0d0a',
                    border: `1px solid ${T.border}`,
                    borderLeft: `2px solid ${T.lime}`,
                    borderRadius: 8,
                    padding: '14px 16px',
                    fontFamily: T.mono,
                    fontSize: 12,
                    color: T.lime,
                    lineHeight: 1.8,
                    maxHeight: 280,
                    overflow: 'auto',
                  }}>
                    {generated.map((c) => (
                      <div key={c}>{c}</div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card style={{ padding: 24 }}>
              <CardHeader
                eyebrow="USERS"
                title="用户"
                right={
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.2 }}>
                    {users.length} TOTAL
                  </span>
                }
              />
              <div style={{ marginTop: 18, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      <Th>EMAIL</Th>
                      <Th>NAME</Th>
                      <Th>ROLE</Th>
                      <Th>JOINED</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderTop: `1px dashed ${T.border}` }}>
                        <Td>{u.email}</Td>
                        <Td>{u.name}</Td>
                        <Td>
                          <span style={{
                            fontFamily: T.mono, fontSize: 10, letterSpacing: 1.2,
                            color: u.role === 'admin' ? T.lime : T.inkDim,
                            padding: '2px 6px',
                            border: `1px solid ${u.role === 'admin' ? T.lime + '60' : T.border}`,
                            borderRadius: 4,
                          }}>{u.role.toUpperCase()}</span>
                        </Td>
                        <Td mono dim>
                          {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                        </Td>
                        <Td>
                          <button
                            onClick={() => grantMax(u.id)}
                            style={{
                              fontFamily: T.mono, fontSize: 10, letterSpacing: 1.2,
                              color: T.lime,
                              background: 'transparent',
                              border: `1px solid ${T.lime}40`,
                              borderRadius: 4,
                              padding: '4px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            + GRANT.MAX
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card style={{ padding: 24 }}>
              <CardHeader
                eyebrow="CODES.RECENT"
                title="最近卡密"
                right={
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.2 }}>
                    {codes.length} ROWS
                  </span>
                }
              />
              <div style={{ marginTop: 18, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      <Th>CODE</Th>
                      <Th>PLAN</Th>
                      <Th>DAYS</Th>
                      <Th>NOTE</Th>
                      <Th>STATUS</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((c) => (
                      <tr key={c.code} style={{ borderTop: `1px dashed ${T.border}` }}>
                        <Td mono>{c.code}</Td>
                        <Td mono>{c.plan.toUpperCase()}</Td>
                        <Td>{c.planDays}</Td>
                        <Td dim>{c.note ?? '—'}</Td>
                        <Td>
                          {c.usedBy ? (
                            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim }}>
                              {new Date(c.usedAt!).toLocaleDateString('zh-CN')} · {c.usedBy.slice(0, 8)}
                            </span>
                          ) : (
                            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.2 }}>● UNUSED</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {tab === 'ai' && <AiConfigSection />}
        {tab === 'usage' && <AiUsageSection />}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, children, code,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  code: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? T.lime : 'transparent'}`,
        padding: '12px 18px',
        marginBottom: -1,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
      }}
    >
      <span style={{
        fontFamily: T.mono, fontSize: 9, letterSpacing: 1.5,
        color: active ? T.lime : T.inkFaint,
      }}>{code}</span>
      <span style={{
        fontSize: 14, fontWeight: 500,
        color: active ? T.ink : T.inkDim,
      }}>{children}</span>
    </button>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{
      fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5,
      fontWeight: 400, padding: '8px 12px 10px 0',
    }}>{children}</th>
  );
}

function Td({
  children, mono, dim,
}: {
  children: React.ReactNode;
  mono?: boolean;
  dim?: boolean;
}) {
  return (
    <td style={{
      padding: '12px 12px 12px 0',
      fontFamily: mono ? T.mono : T.sans,
      fontSize: mono ? 12 : 13,
      color: dim ? T.inkDim : T.ink,
      verticalAlign: 'middle',
    }}>{children}</td>
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
      apiKey: '',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <Banner kind="error" code="ERR">{error}</Banner>}

      <Card style={{ padding: 24 }}>
        <CardHeader
          eyebrow="LLM.CONFIGS"
          title="AI 模型配置"
          right={
            <Btn
              size="sm"
              onClick={startCreate}
              disabled={busy || editingId !== null}
            >
              + 新增
            </Btn>
          }
        />

        <div style={{ marginTop: 18 }}>
          {loading ? (
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
              // LOADING…
            </div>
          ) : configs.length === 0 ? (
            <div style={{
              padding: '32px 20px',
              border: `1px dashed ${T.border}`,
              borderRadius: 8,
              textAlign: 'center',
              color: T.inkDim,
              fontSize: 13,
            }}>
              尚未配置 LLM。点击「+ 新增」开始。
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <Th>NAME</Th>
                    <Th>MODEL</Th>
                    <Th>BASE.URL</Th>
                    <Th>KEY.HINT</Th>
                    <Th>MAX.OUT</Th>
                    <Th>STATUS</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {configs.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderTop: `1px dashed ${T.border}`,
                        background: row.isActive ? T.limeGlow : 'transparent',
                      }}
                    >
                      <Td>
                        <span style={{ fontWeight: 600, color: T.ink }}>{row.name}</span>
                      </Td>
                      <Td mono>{row.model}</Td>
                      <Td mono dim>
                        <span style={{
                          display: 'inline-block', maxWidth: 220,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          verticalAlign: 'bottom',
                        }}>{row.baseUrl}</span>
                      </Td>
                      <Td mono dim>{row.apiKeyHint}</Td>
                      <Td mono>{row.maxOutputTokens}</Td>
                      <Td>
                        {row.isActive ? (
                          <span style={{
                            fontFamily: T.mono, fontSize: 10, letterSpacing: 1.2,
                            color: T.lime,
                            padding: '2px 8px',
                            border: `1px solid ${T.lime}60`,
                            borderRadius: 4,
                          }}>● ACTIVE</span>
                        ) : (
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkGhost, letterSpacing: 1.2 }}>—</span>
                        )}
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                          <RowBtn
                            color={T.lime}
                            onClick={() => startEdit(row)}
                            disabled={busy || editingId !== null}
                          >EDIT</RowBtn>
                          <RowBtn
                            color={T.cyan}
                            onClick={() => activate(row.id)}
                            disabled={busy || row.isActive || editingId !== null}
                          >ACTIVATE</RowBtn>
                          <RowBtn
                            color={T.red}
                            onClick={() => remove(row)}
                            disabled={busy || row.isActive || editingId !== null}
                          >DELETE</RowBtn>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {editingId !== null && (
        <Card hot style={{ padding: 24 }}>
          <CardHeader
            eyebrow={editingId === 'new' ? '// LLM.NEW' : '// LLM.EDIT'}
            title={editingId === 'new' ? '新增配置' : `编辑：${form.name}`}
          />
          <form
            onSubmit={submit}
            style={{
              marginTop: 18,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            <Field label="NAME">
              <TrackInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={50}
                required
              />
            </Field>
            <Field label="MODEL">
              <TrackInput
                mono
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                maxLength={100}
                placeholder="例如 gpt-4o-mini"
                required
              />
            </Field>
            <Field label="BASE.URL" full>
              <TrackInput
                mono
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                required
              />
            </Field>
            <Field label={editingId === 'new' ? 'API.KEY' : 'API.KEY（留空则保留原值）'}>
              <TrackInput
                mono
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                maxLength={200}
                autoComplete="new-password"
                {...(editingId === 'new' ? { required: true } : {})}
              />
            </Field>
            <Field label="MAX.OUTPUT.TOKENS">
              <TrackInput
                type="number"
                min={1}
                max={32768}
                value={form.maxOutputTokens}
                onChange={(e) =>
                  setForm({ ...form, maxOutputTokens: Number(e.target.value) })
                }
                required
              />
            </Field>
            <Field label="ACTIVATE" full>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: T.panelSolid,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  style={{ accentColor: T.lime }}
                />
                <span style={{ fontSize: 13, color: T.inkDim }}>
                  保存后将其设为唯一激活配置
                </span>
              </label>
            </Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <Btn type="submit" disabled={busy}>
                {busy ? '保存中…' : '保存 →'}
              </Btn>
              <Btn type="button" variant="ghost" onClick={cancelEdit} disabled={busy}>
                取消
              </Btn>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function RowBtn({
  children, color, onClick, disabled,
}: {
  children: React.ReactNode;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: T.mono, fontSize: 10, letterSpacing: 1.2,
        color: disabled ? T.inkGhost : color,
        background: 'transparent',
        border: `1px solid ${disabled ? T.border : color + '40'}`,
        borderRadius: 4,
        padding: '4px 8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{children}</button>
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
  const m = Number(mStr) - 1;
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

  const totalIn = entries.reduce((s, e) => s + e.inputTokens, 0);
  const totalOut = entries.reduce((s, e) => s + e.outputTokens, 0);
  const totalGen = entries.reduce((s, e) => s + e.planGenerationCount, 0);
  const totalChat = entries.reduce((s, e) => s + e.chatMessageCount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <Banner kind="error" code="ERR">{error}</Banner>}

      <Card style={{ padding: 24 }}>
        <CardHeader
          eyebrow="AI.USAGE"
          title={`AI 用量 · ${period.slice(0, 7)}`}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RowBtn color={T.inkDim} onClick={() => setPeriod(shiftMonth(period, -1))}>← PREV</RowBtn>
              <input
                type="month"
                value={period.slice(0, 7)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}$/.test(v)) setPeriod(`${v}-01`);
                }}
                className="track-input track-input-mono"
                style={{ width: 130, fontSize: 12, padding: '6px 10px' }}
              />
              <RowBtn color={T.inkDim} onClick={() => setPeriod(shiftMonth(period, 1))}>NEXT →</RowBtn>
              <RowBtn color={T.lime} onClick={() => refresh(period)} disabled={loading}>
                {loading ? 'SYNC…' : '↻ REFRESH'}
              </RowBtn>
            </div>
          }
        />

        {entries.length > 0 && !loading && (
          <div style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 12,
          }}>
            <MiniStat label="USERS" value={entries.length} />
            <MiniStat label="GEN.RUNS" value={totalGen} />
            <MiniStat label="IN.TOKENS" value={totalIn.toLocaleString()} />
            <MiniStat label="OUT.TOKENS" value={totalOut.toLocaleString()} accent />
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {loading ? (
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
              // LOADING…
            </div>
          ) : entries.length === 0 ? (
            <div style={{
              padding: '32px 20px',
              border: `1px dashed ${T.border}`,
              borderRadius: 8,
              textAlign: 'center',
              color: T.inkDim,
              fontSize: 13,
            }}>
              本月暂无用量数据。
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <Th>USER</Th>
                    <Th>PERIOD</Th>
                    <ThRight>GEN</ThRight>
                    <ThRight>CHAT</ThRight>
                    <ThRight>IN.TOKENS</ThRight>
                    <ThRight>OUT.TOKENS</ThRight>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.userId} style={{ borderTop: `1px dashed ${T.border}` }}>
                      <Td>
                        <div style={{ color: T.ink, fontWeight: 500 }}>{e.email}</div>
                        {e.displayName && (
                          <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{e.displayName}</div>
                        )}
                      </Td>
                      <Td mono dim>{e.periodStart.slice(0, 7)}</Td>
                      <TdRight mono>{e.planGenerationCount}</TdRight>
                      <TdRight mono>{e.chatMessageCount}</TdRight>
                      <TdRight mono>{e.inputTokens.toLocaleString()}</TdRight>
                      <TdRight mono accent>{e.outputTokens.toLocaleString()}</TdRight>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: T.panelSolid,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{
        fontFamily: T.mono, fontSize: 22, fontWeight: 600,
        color: accent ? T.lime : T.ink, letterSpacing: -0.5,
      }}>{value}</div>
    </div>
  );
}

function ThRight({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5,
      fontWeight: 400, padding: '8px 0 10px 12px', textAlign: 'right',
    }}>{children}</th>
  );
}

function TdRight({
  children, mono, accent,
}: {
  children: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <td style={{
      padding: '12px 0 12px 12px',
      fontFamily: mono ? T.mono : T.sans,
      fontSize: mono ? 12 : 13,
      color: accent ? T.lime : T.ink,
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    }}>{children}</td>
  );
}
