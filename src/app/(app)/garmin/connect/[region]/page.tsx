'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Tone = 'info' | 'warning' | 'danger' | 'success';
type SsoMessage = {
  status?: unknown;
  serviceTicket?: unknown;
  serviceUrl?: unknown;
  successDetails?: unknown;
  gauthInitHeight?: unknown;
  gauthHeight?: unknown;
  openLiteBox?: unknown;
  errorDetails?: unknown;
};

export default function GarminConnectPage() {
  const params = useParams<{ region: string }>();
  const router = useRouter();
  const region = (params.region === 'cn' ? 'cn' : params.region === 'global' ? 'global' : null) as
    | 'cn'
    | 'global'
    | null;

  const [status, setStatus] = useState('正在加载 Garmin 登录表单…');
  const [tone, setTone] = useState<Tone>('info');
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const widgetRootRef = useRef<HTMLDivElement | null>(null);

  const setStatusMessage = useCallback((message: string, t: Tone = 'info') => {
    setStatus(message);
    setTone(t);
  }, []);

  const invalidRegionError = !region ? '无效区域，请回到上一页重新选择' : null;

  useEffect(() => {
    if (!region) return;
    const root = widgetRootRef.current;
    if (!root) return;

    const ssoOrigin = region === 'cn' ? 'https://sso.garmin.cn' : 'https://sso.garmin.com';
    const ssoEmbed = `${ssoOrigin}/sso/embed`;
    // Build the signin URL directly. We deliberately do NOT use gauth-widget.js
    // because its loadGAuth function defaults `service` to the parent URL when
    // redirectAfterAccountLoginUrl is unset, and Garmin's CAS whitelist rejects
    // non-Garmin service URLs. We need:
    //   service = sso.garmin.{cn,com}/sso/embed   (whitelisted; matches the
    //                                              login-url the @gooin/garmin-connect
    //                                              lib uses for OAuth1 exchange)
    //   consumeServiceTicket = false               (so the post-login flow goes
    //                                              through casEmbedSuccess.html's
    //                                              "send SUCCESS+serviceTicket"
    //                                              branch, NOT the
    //                                              "top.location.href = response_url"
    //                                              branch that would navigate our
    //                                              parent away)
    //   no redirectAfterAccountLoginUrl            (same reason: any non-empty
    //                                              redirectAfter* makes
    //                                              casEmbedSuccess.html navigate
    //                                              the parent away)
    //   source = parent URL                        (server uses this to set
    //                                              parent_url in the rendered
    //                                              templates so XD.postMessage
    //                                              targets us back)
    //   embedWidget = false                        (inline iframe; otherwise the
    //                                              login JS does
    //                                              document.location.href = ...)
    const ssoParams = new URLSearchParams({
      clientId: 'GarminConnect',
      consumeServiceTicket: 'false',
      locale: region === 'cn' ? 'zh_CN' : 'en_US',
      embedWidget: 'false',
      service: ssoEmbed,
      source: window.location.href,
    });
    const iframeSrc = `${ssoOrigin}/sso/signin?${ssoParams.toString()}`;

    // Drop any pre-existing iframe (HMR / region switch).
    root.replaceChildren();

    const iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
    iframe.title = 'Garmin login';
    iframe.style.width = '100%';
    iframe.style.maxWidth = '100%';
    iframe.style.height = '760px';
    iframe.style.border = '0';
    iframe.style.background = 'white';
    root.appendChild(iframe);

    const submitTicket = async (ticket: string, serviceUrl: string | null) => {
      if (submitted.current) return;
      submitted.current = true;
      setStatusMessage('登录成功，正在与服务器绑定…', 'success');
      try {
        const res = await fetch(`${API_URL}/api/garmin/callback/${region}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket, serviceUrl }),
        });
        let data: {
          ok?: boolean;
          error?: string;
          profile?: { fullName?: string; userName?: string };
        } = {};
        try {
          data = await res.json();
        } catch {}
        if (!res.ok || !data.ok) {
          throw new Error(
            data.error ||
              (res.status === 401
                ? '登录态已过期，请重新登录后再连接 Garmin'
                : '绑定失败，请稍后重试'),
          );
        }
        const name = data.profile?.fullName || data.profile?.userName || '';
        const url = new URL('/garmin', window.location.origin);
        url.searchParams.set('connected', region);
        url.searchParams.set('region', region);
        if (name) url.searchParams.set('name', name);
        router.replace(url.toString());
      } catch (e) {
        submitted.current = false;
        setError((e as Error).message);
      }
    };

    const messageListener = (event: MessageEvent) => {
      if (event.origin !== ssoOrigin) return;
      let parsed: SsoMessage | null = null;
      try {
        parsed = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as SsoMessage);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;

      if (typeof parsed.gauthInitHeight === 'number') {
        iframe.style.height = `${Number(parsed.gauthInitHeight) + 20}px`;
        setStatusMessage('Garmin 官方登录表单已加载，请直接在下方完成登录');
        return;
      }
      if (typeof parsed.gauthHeight === 'number') {
        iframe.style.height = `${Number(parsed.gauthHeight) + 20}px`;
        return;
      }
      if (parsed.openLiteBox) {
        setStatusMessage('Garmin 打开了附加验证（图形验证码），请在下方页面继续', 'warning');
        return;
      }

      const status = typeof parsed.status === 'string' ? parsed.status : null;
      const ticket = typeof parsed.serviceTicket === 'string' ? parsed.serviceTicket : null;
      const serviceUrl =
        typeof parsed.serviceUrl === 'string' && parsed.serviceUrl ? parsed.serviceUrl : null;

      if (status === 'SUCCESS' && ticket) {
        submitTicket(ticket, serviceUrl);
        return;
      }
      if (status === 'SUCCESS' && !ticket) {
        // Should not happen with our config — the casEmbedSuccess.html
        // SUCCESS-without-ticket branch only fires when redirectAfter* is set,
        // and that path also does top.location.href which would have
        // navigated us away anyway.
        setStatusMessage('Garmin 返回成功但缺 ticket，请刷新页面重试', 'danger');
        return;
      }
      if (status === 'FAIL') {
        setStatusMessage('账号或密码错误，请在下方表单中重新输入', 'danger');
        return;
      }
      if (status === 'ACCOUNT_LOCKED') {
        setStatusMessage('Garmin 账号被暂时锁定，请稍后再试', 'danger');
        return;
      }
      if (status === 'ACCOUNT_DISABLED') {
        setStatusMessage('Garmin 账号不可用，请先在官方页面确认账号状态', 'danger');
        return;
      }
    };
    window.addEventListener('message', messageListener);

    return () => {
      window.removeEventListener('message', messageListener);
      iframe.remove();
    };
  }, [region, router, setStatusMessage]);

  const toneClass = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }[tone];

  const regionLabel = region === 'cn' ? '国区 (garmin.cn)' : region === 'global' ? '国际区 (garmin.com)' : '';
  const displayError = invalidRegionError || error;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <Link href="/garmin" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← 返回
          </Link>
          <h1 className="text-2xl font-bold mt-2">连接 {regionLabel} Garmin</h1>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
            下方登录表单由 Garmin 官方的 <span className="font-mono">sso.garmin.{region === 'cn' ? 'cn' : 'com'}</span> 渲染。
          </p>
          <p className="text-sm text-red-600 mt-1 font-medium leading-relaxed">
            你的 Garmin 密码直接提交到 <span className="font-mono">sso.garmin.{region === 'cn' ? 'cn' : 'com'}</span>，不经过我们的服务器。我们只收到 Garmin 返回的一次性登录票据用于换取 OAuth 令牌。
          </p>
        </header>

        {displayError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {displayError}
            <div className="mt-3">
              <Link href="/garmin" className="text-emerald-600 hover:underline">
                返回重试
              </Link>
            </div>
          </div>
        ) : (
          <div className={`rounded-xl border p-3 text-sm ${toneClass}`}>{status}</div>
        )}

        <div
          ref={widgetRootRef}
          id="gauth-widget"
          className="bg-white border border-zinc-200 rounded-2xl p-2 min-h-[640px]"
        />
      </div>
    </main>
  );
}
