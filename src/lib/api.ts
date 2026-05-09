export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const API_URL = API_BASE;

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
    let body: { error?: string } | null = null;
    try {
      body = (await res.json()) as { error?: string };
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
  result: {
    uploaded?: number;
    skipped?: number;
    failed?: number;
    cnToGlobal?: { uploaded: number; skipped: number; failed: number };
    globalToCn?: { uploaded: number; skipped: number; failed: number };
  } | null;
  error: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

// ===== Training plans =====

export type Sport =
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'rest'
  | 'strength'
  | 'mobility';

export type TargetMetric = 'heart_rate' | 'pace' | 'power' | 'mixed' | 'none';
export type WorkoutStatus = 'planned' | 'completed' | 'skipped' | 'regenerating';
export type PlanStatus = 'generating' | 'ready' | 'failed' | 'archived';

export const SPORT_LABELS: Record<Sport, string> = {
  running: '🏃 跑步',
  cycling: '🚴 骑行',
  swimming: '🏊 游泳',
  rest: '💤 休息',
  strength: '💪 力量',
  mobility: '🧘 活动恢复',
};

export interface TrainingPlanSummary {
  id: string;
  weekStartDate: string; // 'YYYY-MM-DD'
  status: PlanStatus;
  summary: string | null;
  createdAt: string;
}

export interface TrainingWorkout {
  id: string;
  planId: string;
  dayIndex: number;
  date: string;
  sport: Sport;
  templateId: string;
  workoutType: string | null;
  title: string;
  intensity: 'low' | 'medium' | 'high' | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  targetMetric: TargetMetric;
  targetHeartRate: string;
  targetPace: string;
  targetPower: string;
  workoutStructure: string;
  targets: string[];
  parameterSource: unknown;
  adaptation: string | null;
  status: WorkoutStatus;
}

export interface TrainingChatMessage {
  id: string;
  planId: string;
  userId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls: unknown;
  toolResultRefs: unknown;
  createdAt: string;
}

export interface TrainingPlanDetail {
  plan: TrainingPlanSummary & {
    request: unknown;
    monitoring: string | null;
    adjustmentRules: string | null;
    modelMeta: unknown;
    athleteProfileSnapshot: unknown;
  };
  workouts: TrainingWorkout[];
  messages: TrainingChatMessage[];
}

export interface TrainingPlanRequest {
  goal?: string;
  raceDate?: string | null;
  goalDistance?: string | null;
  weekStartDate: string;
  daysPerWeek: number;
  preferredRestDay?: string;
  availableTime?: string;
  injuries?: string;
  notes?: string;
  sports: { running: boolean; cycling: boolean; swimming: boolean };
  sportPriorities?: Sport[];
  preferredKeyWorkoutDays?: string[];
  maxHardSessionsPerWeek: number | null;
  targetMetricPreference: 'auto' | 'heart_rate' | 'pace';
}

export async function listTrainingPlans(): Promise<{ plans: TrainingPlanSummary[] }> {
  return api.get<{ plans: TrainingPlanSummary[] }>('/api/training/plans');
}

export async function getTrainingPlan(id: string): Promise<TrainingPlanDetail> {
  return api.get<TrainingPlanDetail>(
    `/api/training/plans/${encodeURIComponent(id)}`,
  );
}

export async function patchTrainingWorkout(
  id: string,
  body: { status: WorkoutStatus },
): Promise<TrainingWorkout> {
  const r = await api.patch<{ workout: TrainingWorkout }>(
    `/api/training/workouts/${encodeURIComponent(id)}`,
    body,
  );
  return r.workout;
}

export const trainingPlanStreamUrl = `${API_BASE}/api/training/plans`;
export const trainingDayRegenerateUrl = (planId: string) =>
  `${API_BASE}/api/training/plans/${encodeURIComponent(planId)}/regenerate-day`;
