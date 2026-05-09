'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listTrainingPlans,
  type PlanStatus,
  type TrainingPlanSummary,
} from '@/lib/api';

const STATUS_LABEL: Record<PlanStatus, string> = {
  generating: '生成中',
  ready: '就绪',
  failed: '失败',
  archived: '已归档',
};

const STATUS_CLASS: Record<PlanStatus, string> = {
  generating: 'bg-blue-100 text-blue-700',
  ready: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  archived: 'bg-zinc-100 text-zinc-500',
};

function StatusPill({ status }: { status: PlanStatus }) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatWeekStart(d: string): string {
  // Treat YYYY-MM-DD as local date (not UTC) to avoid TZ off-by-one.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[2])}月${Number(m[3])}日 ${WEEKDAY_LABELS[date.getDay()]}`;
}

function summaryPreview(s: string | null): string {
  if (!s) return '—';
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

export default function TrainingListPage() {
  const [plans, setPlans] = useState<TrainingPlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTrainingPlans()
      .then((r) => setPlans(r.plans))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">训练计划</h1>
          <p className="text-zinc-500 mt-1">
            基于近期 Garmin 数据生成的周计划。每周一份。
          </p>
        </div>
        <Link
          href="/training/new"
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          新建计划
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {plans === null && !error && (
        <p className="text-sm text-zinc-500">加载中…</p>
      )}

      {plans && plans.length === 0 && (
        <section className="bg-white border border-zinc-200 rounded-2xl p-10 text-center">
          <p className="text-zinc-600">你还没有训练计划。</p>
          <Link
            href="/training/new"
            className="inline-block mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            新建第一个计划
          </Link>
        </section>
      )}

      {plans && plans.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          {plans.map((p) => (
            <article
              key={p.id}
              className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {formatWeekStart(p.weekStartDate)}
                </h2>
                <StatusPill status={p.status} />
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed flex-1">
                {summaryPreview(p.summary)}
              </p>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  创建于 {new Date(p.createdAt).toLocaleDateString('zh-CN')}
                </span>
                <Link
                  href={`/training/${p.id}`}
                  className="text-emerald-600 hover:underline font-medium"
                >
                  查看详情 →
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
