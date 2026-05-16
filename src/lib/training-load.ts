import type {
  TrainingPlanModelMeta,
  TrainingWorkout,
  TrainingWorkoutParameterSource,
} from '@/lib/api';

type LoadCalendarItem = {
  estimatedTrainingLoad?: unknown;
};

export function readPlanEstimatedTrainingLoad(modelMeta: TrainingPlanModelMeta | null | undefined): number | null {
  const raw = modelMeta?.estimatedTrainingLoad?.estimated;
  return normalizeLoad(raw);
}

export function readWorkoutEstimatedTrainingLoad(
  parameterSource: TrainingWorkoutParameterSource | null | undefined,
): number | null {
  const raw = parameterSource?.replacedVariables?.__estimated_training_load;
  return normalizeLoad(raw);
}

export function sumWorkoutEstimatedTrainingLoad(workouts: TrainingWorkout[]): number | null {
  let total = 0;
  let found = false;
  for (const workout of workouts) {
    const load = readWorkoutEstimatedTrainingLoad(workout.parameterSource);
    if (load == null) continue;
    total += load;
    found = true;
  }
  return found ? Math.round(total) : null;
}

export function sumCalendarEstimatedTrainingLoad(
  workouts: Map<number, LoadCalendarItem | LoadCalendarItem[]>,
): number | null {
  let total = 0;
  let found = false;
  for (const raw of workouts.values()) {
    const items = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      const load = normalizeLoad(item.estimatedTrainingLoad);
      if (load == null) continue;
      total += load;
      found = true;
    }
  }
  return found ? Math.round(total) : null;
}

export function readScheduleNoteEstimatedTrainingLoad(notes: string[]): number | null {
  for (const note of notes) {
    const m = /预计\s*Garmin\s*周训练负荷约\s*(\d+(?:\.\d+)?)/i.exec(note);
    const load = normalizeLoad(m?.[1]);
    if (load != null) return load;
  }
  return null;
}

function normalizeLoad(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}
