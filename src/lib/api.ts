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

export type GarminRegion = 'cn' | 'global';

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

export interface AiUsageEntry {
  userId: string;
  email: string;
  displayName: string | null;
  periodStart: string;
  planGenerationCount: number;
  chatMessageCount: number;
  inputTokens: number;
  outputTokens: number;
}

export async function listAiUsage(
  periodStart?: string,
): Promise<{ entries: AiUsageEntry[] }> {
  const qs = periodStart
    ? `?periodStart=${encodeURIComponent(periodStart)}`
    : '';
  return api.get<{ entries: AiUsageEntry[] }>(`/api/admin/ai-usage${qs}`);
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
  updatedAt?: string;
}

export interface TrainingWorkout {
  id: string;
  planId: string;
  dayIndex: number;
  slotIndex: number;
  date: string;
  sessionLabel: string | null;
  timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening' | null;
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

export interface GarminPushedWorkoutSummary {
  id: string;
  localWorkoutId: string;
  garminWorkoutId: string | null;
  garminScheduleId: string | null;
  scheduledDate: string;
  workoutName: string;
  status: 'scheduled' | 'deleting' | 'deleted' | 'failed';
  lastError: string | null;
  updatedAt: string;
}

export interface GarminPlanPublishStatus {
  region: GarminRegion;
  uploaded: boolean;
  total: number;
  scheduled: number;
  deleting: number;
  deleted: number;
  failed: number;
  activeCount: number;
  lastUpdatedAt: string | null;
  workouts: GarminPushedWorkoutSummary[];
}

export interface GarminPlanPushResult {
  status: GarminPlanPublishStatus;
  pushed: number;
  skipped: number;
  failed: number;
  deletedBeforePush: number;
  blockedByCleanup: boolean;
  failures: Array<{ localWorkoutId: string; message: string }>;
}

export interface GarminPlanDeleteResult {
  status: GarminPlanPublishStatus;
  deleted: number;
  failed: number;
  failures: Array<{
    id: string;
    localWorkoutId: string;
    garminWorkoutId: string | null;
    garminScheduleId: string | null;
    message: string;
  }>;
}

export interface TrainingCalendarEvent {
  id: string;
  kind: 'planned_workout' | 'garmin_activity';
  date: string;
  startTimeLocal: string | null;
  title: string;
  sport: Sport | 'other';
  source: 'training_plan' | 'garmin';
  planId: string | null;
  workoutId: string | null;
  activityId: string | number | null;
  region: GarminRegion | 'manual' | null;
  status: WorkoutStatus | null;
  slotIndex: number | null;
  sessionLabel: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  intensity: 'low' | 'medium' | 'high' | null;
  targetMetric: TargetMetric | null;
  targetHeartRate: string | null;
  targetPace: string | null;
  targetPower: string | null;
  workoutStructure: string | null;
  targets: string[] | null;
  metrics: Record<string, number | string | null>;
}

export interface EvaluationPairing {
  workoutId: string;
  workoutTitle: string;
  sport: string;
  matchedActivityRef: { region: string; activityId: string } | null;
  verdict: 'matched' | 'partial' | 'missed' | 'different_sport';
  subScore: number;
  notes: string[];
}

export interface TrainingEvaluationResult {
  title: string;
  summary: string;
  plannedWorkoutCount: number;
  activityCount: number;
  score?: number;
  verdict?: string;
  adherence?: {
    sportMatched: boolean;
    durationRatio: number | null;
    distanceRatio: number | null;
    intensityMatched: boolean | null;
  };
  load?: { planned: string | null; actual: number | null; comment: string };
  intensity?: { planned: string | null; actual: string | null; comment: string };
  highlights?: string[];
  risks?: string[];
  suggestions?: string[];
  pairings?: EvaluationPairing[];
}

export interface TrainingEvaluationSummary {
  id: string;
  date: string;
  planId: string | null;
  plannedWorkoutIds: string[];
  activityRefs: Array<{ region: GarminRegion | 'manual'; activityId: string }>;
  status: 'pending' | 'ready' | 'failed';
  result: TrainingEvaluationResult | null;
  note: string | null;
  createdAt: string;
}

export interface TrainingCalendarResponse {
  calendar: {
    activePlan: TrainingPlanSummary | null;
    activePlanId: string | null;
    from: string;
    to: string;
    activitySources?: Array<{
      region: GarminRegion;
      count: number;
      error: string | null;
    }>;
  };
  events: TrainingCalendarEvent[];
  evaluations: TrainingEvaluationSummary[];
}

export interface TrainingPlanRequest {
  goal?: string;
  raceDate?: string | null;
  goalDistance?: string | null;
  weekStartDate: string;
  daysPerWeek: number;
  preferredRestDay?: string;
  availableTime?: string;
  preferredTrainingWindows?: string[];
  dailyPreferredMinutes?: number | null;
  weeklyMaxMinutes?: number | null;
  expectedLoad?: number | null;
  allowAdvancedWorkouts?: boolean;
  allowDoubleDays?: boolean;
  forceRequestedSchedule?: boolean;
  exportFormats?: Array<'intervals_icu' | 'word' | 'pdf' | 'excel'>;
  injuries?: string;
  notes?: string;
  sports: { running: boolean; cycling: boolean; swimming: boolean };
  sportPriorities?: Sport[];
  preferredKeyWorkoutDays?: string[];
  maxHardSessionsPerWeek: number | null;
  targetMetricPreference: 'auto' | 'heart_rate' | 'pace';
}

export interface TrainingCapacityView {
  overall: {
    level: 'novice' | 'developing' | 'trained' | 'advanced' | string;
    readiness: 'green' | 'yellow' | 'red' | string;
    readinessConfidence: 'low' | 'medium' | 'high' | string;
    risk: 'low' | 'moderate' | 'high' | string;
    reasons: string[];
  };
  load: {
    acute7d: { minutes: number; load: number; sessions: number };
    chronic28d: { minutes: number; load: number; sessions: number };
    chronic56d?: { minutes: number; load: number; sessions: number };
    acuteChronicRatio: number | null;
    monotony: number | null;
    strain: number | null;
  };
  recovery: {
    sleepRisk: 'low' | 'moderate' | 'high' | 'unknown' | string;
    hrvRisk: 'low' | 'moderate' | 'high' | 'unknown' | string;
    trainingStatusRisk: 'low' | 'moderate' | 'high' | 'unknown' | string;
    recoveryTimeRisk: 'low' | 'moderate' | 'high' | 'unknown' | string;
    latestSleepScore: number | null;
    latestHrvStatus: string | null;
    latestTrainingStatus: string | null;
    latestRecoveryTimeHours: number | null;
  };
  guardrails: {
    maxHardSessionsPerWeek: number;
    maxHighMinutesShare?: number;
    minLowMinutesShare?: number;
    allowHighIntensity: boolean;
    allowDoubleDays: boolean;
    maxSessionMinutes?: Record<string, number>;
    maxLongSessionMinutes?: Record<string, number>;
    notes: string[];
  };
}

export async function listTrainingPlans(): Promise<{ plans: TrainingPlanSummary[] }> {
  return api.get<{ plans: TrainingPlanSummary[] }>('/api/training/plans');
}

export async function getTrainingPlan(id: string): Promise<TrainingPlanDetail> {
  return api.get<TrainingPlanDetail>(
    `/api/training/plans/${encodeURIComponent(id)}`,
  );
}

export async function deleteTrainingPlan(id: string): Promise<{ deletedPlanId: string }> {
  return api.del<{ deletedPlanId: string }>(
    `/api/training/plans/${encodeURIComponent(id)}`,
  );
}

export async function getTrainingPlanGarminStatus(
  id: string,
  region: GarminRegion,
): Promise<GarminPlanPublishStatus> {
  const r = await api.get<{ status: GarminPlanPublishStatus }>(
    `/api/training/plans/${encodeURIComponent(id)}/garmin?region=${encodeURIComponent(region)}`,
  );
  return r.status;
}

export async function pushTrainingPlanToGarmin(
  id: string,
  region: GarminRegion,
): Promise<GarminPlanPushResult> {
  return api.post<GarminPlanPushResult>(
    `/api/training/plans/${encodeURIComponent(id)}/garmin`,
    { region },
  );
}

export async function deleteTrainingPlanFromGarmin(
  id: string,
  region: GarminRegion,
): Promise<GarminPlanDeleteResult> {
  return api.del<GarminPlanDeleteResult>(
    `/api/training/plans/${encodeURIComponent(id)}/garmin?region=${encodeURIComponent(region)}`,
  );
}

export async function getTrainingCalendar(params?: {
  from?: string;
  to?: string;
}): Promise<TrainingCalendarResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get<TrainingCalendarResponse>(`/api/training/calendar${suffix}`);
}

export async function createTrainingEvaluation(body: {
  date: string;
  activityRefs: Array<{ region: GarminRegion | 'manual'; activityId: string | number }>;
  note?: string;
}): Promise<{ evaluation: TrainingEvaluationSummary }> {
  return api.post<{ evaluation: TrainingEvaluationSummary }>(
    '/api/training/calendar/evaluations',
    body,
  );
}

export async function importPlanToCalendar(
  planId: string,
): Promise<{ activePlanId: string; activePlan: TrainingPlanSummary }> {
  return api.post<{ activePlanId: string; activePlan: TrainingPlanSummary }>(
    `/api/training/plans/${encodeURIComponent(planId)}/import-calendar`,
  );
}

export async function clearCalendarTrainingPlan(): Promise<{ activePlanId: null }> {
  return api.del<{ activePlanId: null }>('/api/training/calendar/active-plan');
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
export const trainingChatStreamUrl = (planId: string) =>
  `${API_BASE}/api/training/plans/${encodeURIComponent(planId)}/chat`;
export const trainingPlanExportUrl = (
  planId: string,
  format: 'intervals_icu' | 'word' | 'pdf' | 'excel',
) => `${API_BASE}/api/training/plans/${encodeURIComponent(planId)}/export/${format}`;

export async function listTrainingChatMessages(
  planId: string,
): Promise<{ messages: TrainingChatMessage[] }> {
  return api.get<{ messages: TrainingChatMessage[] }>(
    `/api/training/plans/${encodeURIComponent(planId)}/messages`,
  );
}
