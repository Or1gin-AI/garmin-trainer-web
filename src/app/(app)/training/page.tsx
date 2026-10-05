'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiError,
  deleteTrainingPlan,
  listTrainingPlans,
  type PlanStatus,
  type TrainingPlanSummary,
} from '@/lib/api';
import {
  T, Btn, Card, SectionLabel, StatusBadge, PageHero, Banner,
  type StatusKind,
} from '@/components/track';
import { formatWeekStartShort, planShortId } from '@/lib/format';

const PLAN_LIMIT = 10;

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

function summaryPreview(s: string | null): string {
  if (!s) return '—';
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
}

export default function TrainingListPage() {
  const [plans, setPlans] = useState<TrainingPlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [openingPlanId, setOpeningPlanId] = useState<string | null>(null);

  useEffect(() => {
    listTrainingPlans()
      .then((r) =>
        setPlans(
          r.plans
            .slice()
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        ),
      )
      .catch((e) => setError((e as Error).message));
  }, []);

  const active = (plans ?? []).filter((p) => p.status !== 'archived');
  const archived = (plans ?? []).filter((p) => p.status === 'archived');
  const planCount = plans?.length ?? 0;
  const limitReached = plans !== null && planCount >= PLAN_LIMIT;

  async function handleDelete(plan: TrainingPlanSummary) {
    const ok = window.confirm(
      'ConfirmDelete this local training plan?ifalreadyUploadto Garmin，Please inDetailsfrom CN/International Garmin Deleteremote。',
    );
    if (!ok) return;
    setDeletingPlanId(plan.id);
    setError(null);
    try {
      await deleteTrainingPlan(plan.id);
      setPlans((prev) => (prev ?? []).filter((p) => p.id !== plan.id));
    } catch (e) {
      const err = e as ApiError;
      const detail = err.detail as { error?: string; activeCount?: number } | undefined;
      setError(
        detail?.error === 'garmin_plan_uploaded'
          ? `This plan still has ${detail.activeCount ?? 0}  Garmin remote，Please toDetailsfrom  Garmin Deleteplan。`
          : err.message,
      );
    } finally {
      setDeletingPlanId(null);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Trainingplan"
        title="Trainingplan"
        sub={`AI your Goal + Garmin historydataGenerateWeekly plan。current  ${planCount}/${PLAN_LIMIT} plans。`}
        actions={
          limitReached ? (
            <Btn disabled> 10 planslimit</Btn>
          ) : (
            <Link href="/training/new" style={{ textDecoration: 'none' }}>
              <Btn>+ New plan</Btn>
            </Link>
          )
        }
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      {limitReached && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="warn" code="LIMIT">You can keep at most {PLAN_LIMIT} plansTrainingplan。Deleteold plancanContinuenew 。</Banner>
        </div>
      )}

      {plans === null && !error && (
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
          // Loading…
        </div>
      )}

      {plans && plans.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, marginBottom: 8 }}>Noneplan</div>
          <p style={{ color: T.inkDim, fontSize: 14, margin: '0 0 18px' }}>No Trainingplan。</p>
          <Link href="/training/new" style={{ textDecoration: 'none' }}>
            <Btn>new Day oneplan</Btn>
          </Link>
        </Card>
      )}

      {active.length > 0 && (
        <>
          <SectionLabel>Active plans</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {active.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                deleting={deletingPlanId === p.id}
                opening={openingPlanId === p.id}
                onOpen={() => setOpeningPlanId(p.id)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <SectionLabel>Archived</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {archived.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                archived
                deleting={deletingPlanId === p.id}
                opening={openingPlanId === p.id}
                onOpen={() => setOpeningPlanId(p.id)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function PlanRow({
  plan,
  archived,
  deleting,
  opening,
  onOpen,
  onDelete,
}: {
  plan: TrainingPlanSummary;
  archived?: boolean;
  deleting: boolean;
  opening: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();

  function openPlan() {
    if (opening || deleting) return;
    onOpen();
    router.push(`/training/${plan.id}`);
  }

  return (
    <Card
      hover
      onClick={openPlan}
      style={{
        padding: 20,
        opacity: archived ? 0.55 : 1,
        cursor: opening || deleting ? 'wait' : 'pointer',
        borderColor: opening ? T.lime : undefined,
        boxShadow: opening ? `0 0 22px ${T.limeGlow}` : undefined,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto', gap: 18, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, fontWeight: 600 }}>
              {planShortId(plan.id)}
            </span>
            {opening ? <StatusBadge kind="running" size="sm" /> : <StatusBadge kind={STATUS_MAP[plan.status]} size="sm" />}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.ink }}>
            {formatWeekStartShort(plan.weekStartDate)}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: T.inkDim, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {opening ? 'inplan…' : summaryPreview(plan.summary)}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>Create </div>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim }}>
            {new Date(plan.createdAt).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openPlan();
            }}
            disabled={opening || deleting}
          >
            {opening ? 'ing…' : 'Details'}
          </Btn>
          <Btn
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting || opening}
          >
            {deleting ? 'Deleteing…' : 'Delete'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
