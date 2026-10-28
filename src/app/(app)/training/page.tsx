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
  T, Btn, Card, SectionLabel, StatusBadge, PageHero, Banner, Pill, LABEL,
  type StatusKind,
} from '@/components/track';
import { formatWeekRange, weekRelation } from '@/lib/format';

const PLAN_LIMIT = 10;

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

const RELATION_PILL = {
  current: { label: 'This week', color: T.lime },
  upcoming: { label: 'Upcoming', color: T.cyan },
  past: { label: 'Past week', color: T.inkFaint },
} as const;

function summaryText(s: string | null): string {
  if (!s) return 'No summary yet.';
  return s.replace(/\s+/g, ' ').trim();
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

  const nonArchived = (plans ?? []).filter((p) => p.status !== 'archived');
  const archived = (plans ?? []).filter((p) => p.status === 'archived');
  const featured =
    nonArchived.find((p) => p.status === 'ready' && weekRelation(p.weekStartDate) === 'current')
    ?? nonArchived.find((p) => p.status === 'ready' && weekRelation(p.weekStartDate) === 'upcoming')
    ?? null;
  const others = nonArchived.filter((p) => p !== featured);
  const planCount = plans?.length ?? 0;
  const limitReached = plans !== null && planCount >= PLAN_LIMIT;

  async function handleDelete(plan: TrainingPlanSummary) {
    const ok = window.confirm(
      'Delete this training plan? If it was uploaded to Garmin, remove it from Garmin on the plan page first.',
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
          ? `This plan still has ${detail.activeCount ?? 0} workout(s) on your Garmin calendar. Remove them from Garmin on the plan page first.`
          : err.message,
      );
    } finally {
      setDeletingPlanId(null);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="AI Coach"
        title="Training Plans"
        sub="Weekly plans built from your goals and Garmin history. Every session comes with clear targets, a structured breakdown and rules for adapting on the fly."
        actions={
          limitReached ? (
            <Btn disabled>Plan limit reached</Btn>
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
          <Banner kind="warn" code="LIMIT">You can keep up to {PLAN_LIMIT} training plans. Delete an old one to create another.</Banner>
        </div>
      )}

      {plans === null && !error && (
        <div style={{ fontSize: 14, color: T.inkFaint }} className="track-blink">
          Loading plans…
        </div>
      )}

      {plans && plans.length === 0 && (
        <Card style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ ...LABEL, color: T.lime, marginBottom: 10 }}>No plans yet</div>
          <p style={{ color: T.inkDim, fontSize: 15, margin: '0 0 20px' }}>Tell the AI coach your goal and it will build your first week.</p>
          <Link href="/training/new" style={{ textDecoration: 'none' }}>
            <Btn>Create your first plan</Btn>
          </Link>
        </Card>
      )}

      {featured && (
        <FeaturedPlan
          plan={featured}
          opening={openingPlanId === featured.id}
          onOpen={() => setOpeningPlanId(featured.id)}
        />
      )}

      {others.length > 0 && (
        <>
          <SectionLabel right={<span style={{ fontSize: 12, color: T.inkFaint }}>{planCount} of {PLAN_LIMIT} plans used</span>}>
            {featured ? 'Other plans' : 'Your plans'}
          </SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, marginBottom: 28 }}>
            {others.map((p) => (
              <PlanCard
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {archived.map((p) => (
              <PlanCard
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

function FeaturedPlan({
  plan,
  opening,
  onOpen,
}: {
  plan: TrainingPlanSummary;
  opening: boolean;
  onOpen: () => void;
}) {
  const router = useRouter();
  const rel = weekRelation(plan.weekStartDate);
  const pill = rel ? RELATION_PILL[rel] : null;

  function open() {
    if (opening) return;
    onOpen();
    router.push(`/training/${plan.id}`);
  }

  return (
    <Card
      hover
      onClick={open}
      style={{
        padding: 0,
        marginBottom: 32,
        background: 'linear-gradient(135deg, rgba(198,255,58,0.11), rgba(18,22,20,0.96) 48%), #121614',
        borderColor: 'rgba(198,255,58,0.28)',
      }}
    >
      <div style={{ padding: '26px 28px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {pill && <Pill color={pill.color} solid={rel === 'current'}>{pill.label}</Pill>}
            <StatusBadge kind={STATUS_MAP[plan.status]} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: '-0.02em', color: T.ink, marginBottom: 10 }}>
            {formatWeekRange(plan.weekStartDate)}
          </div>
          <p style={{ margin: 0, fontSize: 15, color: T.inkDim, lineHeight: 1.65, maxWidth: 820 }}>
            {summaryText(plan.summary)}
          </p>
        </div>
        <Btn onClick={(e) => { e.stopPropagation(); open(); }} disabled={opening}>
          {opening ? 'Opening…' : 'Open this week →'}
        </Btn>
      </div>
    </Card>
  );
}

function PlanCard({
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
  const rel = weekRelation(plan.weekStartDate);
  const pill = rel ? RELATION_PILL[rel] : null;

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
        opacity: archived ? 0.6 : 1,
        cursor: opening || deleting ? 'wait' : 'pointer',
        borderColor: opening ? T.lime : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {opening ? <StatusBadge kind="running" size="sm" /> : <StatusBadge kind={STATUS_MAP[plan.status]} size="sm" />}
        {pill && <Pill color={pill.color} size="sm">{pill.label}</Pill>}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: T.ink }}>
        {formatWeekRange(plan.weekStartDate)}
      </div>
      <div style={{
        fontSize: 14, color: T.inkDim, lineHeight: 1.6, flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
      }}>
        {opening ? 'Opening plan…' : summaryText(plan.summary)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
        <span style={{ flex: 1, fontSize: 12, color: T.inkFaint }}>
          Created {new Date(plan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <Btn
          variant="danger"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting || opening}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openPlan();
          }}
          disabled={opening || deleting}
        >
          {opening ? 'Opening…' : 'View plan'}
        </Btn>
      </div>
    </Card>
  );
}
