'use client';

// Placeholder for U10. Renders a greyed-out input + 'coming soon' message
// so users see the chat seat in the layout but understand it's not live yet.

export function ChatPanel() {
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">AI 教练对话</h3>
        <span className="text-xs text-zinc-400">即将上线</span>
      </div>
      <p className="text-sm text-zinc-500 leading-relaxed">
        AI 教练对话功能即将上线。届时你可以追问训练强度、调整某天计划、
        或者请教练根据近期表现重排整周。
      </p>
      <div className="space-y-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400">
          这周的长跑可以挪到周日吗？
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400">
          周三的间歇看起来太重，能换成节奏跑吗？
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <input
          disabled
          placeholder="输入框将在 U10 启用…"
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
        />
        <button
          disabled
          className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-400 text-sm font-medium cursor-not-allowed"
        >
          发送
        </button>
      </div>
    </section>
  );
}
