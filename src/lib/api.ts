const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {}
    throw new ApiError(
      res.status,
      body?.error || `HTTP ${res.status}`,
      body,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

// ===== Typed endpoints =====

export interface UserPlanInfo {
  plan: 'free' | 'pro';
  expiresAt: string | null;
  isProActive: boolean;
  autoSyncEnabled: boolean;
  lastAutoSyncAt: string | null;
}

export interface MeResponse {
  user: { id: string; email: string; name: string; role: string };
  plan: UserPlanInfo;
}

export interface GarminAccountSummary {
  region: 'cn' | 'global';
  configured: boolean;
  hasSession: boolean;
  profile: { fullName?: string; userName?: string; location?: string } | null;
  lastValidatedAt: string | null;
}

export interface LlmConfigSummary {
  id: number;
  name: string;
  baseUrl: string;
  model: string;
  maxOutputTokens: number;
  isActive: boolean;
  apiKeyHint: string;
  createdAt: string;
  updatedAt: string;
}

export interface LlmConfigCreateBody {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxOutputTokens?: number;
  isActive?: boolean;
}

export type LlmConfigUpdateBody = Partial<LlmConfigCreateBody>;

export async function listLlmConfigs(): Promise<LlmConfigSummary[]> {
  const r = await api.get<{ configs: LlmConfigSummary[] }>('/api/admin/llm-configs');
  return r.configs;
}

export async function createLlmConfig(
  body: LlmConfigCreateBody,
): Promise<LlmConfigSummary> {
  return api.post<LlmConfigSummary>('/api/admin/llm-configs', body);
}

export async function updateLlmConfig(
  id: number,
  body: LlmConfigUpdateBody,
): Promise<LlmConfigSummary> {
  return api.put<LlmConfigSummary>(`/api/admin/llm-configs/${id}`, body);
}

export async function activateLlmConfig(id: number): Promise<LlmConfigSummary> {
  return api.post<LlmConfigSummary>(`/api/admin/llm-configs/${id}/activate`);
}

export async function deleteLlmConfig(id: number): Promise<void> {
  await api.del<void>(`/api/admin/llm-configs/${id}`);
}

export interface SyncJob {
  id: string;
  userId: string;
  mode: 'incremental' | 'history';
  trigger: 'manual' | 'cron';
  status: 'queued' | 'running' | 'success' | 'failed' | 'aborted';
  progress: {
    stage?: string;
    message?: string;
    total?: number | null;
    completed?: number;
    scanned?: number;
    uploaded?: number;
    skipped?: number;
    failed?: number;
    percent?: number | null;
    logs?: { at: string; level: string; message: string }[];
  } | null;
  result: { uploaded?: number; skipped?: number; failed?: number } | null;
  error: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
