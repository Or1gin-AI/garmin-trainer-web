'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Tone = 'info' | 'warning' | 'danger' | 'success';
type GAuthPayload = {
  serviceTicket?: unknown;
  serviceUrl?: unknown;
  gauthInitHeight?: unknown;
  status?: unknown;
  openLiteBox?: unknown;
  errorDetails?: unknown;
};
type GAuthHandler = (e: unknown, data?: unknown) => void;

declare global {
  interface Window {
    GAUTH?: {
      init: (config: Record<string, unknown>) => void;
      loadGAuth: () => void;
      checkAuthentication: () => void;
    };
    GAUTH_Events?: {
      addListener: (event: string, handler: GAuthHandler) => void;
      removeListener?: (event: string, handler: GAuthHandler) => void;
    };
  }
}

export default function GarminConnectPage() {
  const params = useParams<{ region: string }>();
  const router = useRouter();
  const region = (params.region === 'cn' ? 'cn' : params.region === 'global' ? 'global' : null) as
    | 'cn'
    | 'global'
    | null;

  const [status, setStatus] = useState('正在加载 Garmin 登录小组件…');
  const [tone, setTone] = useState<Tone>('info');
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const submitted = useRef(false);
  const widgetRootRef = useRef<HTMLDivElement | null>(null);

  const setStatusMessage = useCallback((message: string, t: Tone = 'info') => {
    setStatus(message);
    setTone(t);
  }, []);

  const invalidRegionError = !region ? '无效区域，请回到上一页重新选择' : null;

  useEffect(() => {
    if (!region) {
      return;
    }
    if (initialized.current) return;
    initialized.current = true;

    const ssoBase = region === 'cn' ? 'https://sso.garmin.cn/sso' : 'https://sso.garmin.com/sso';
    const widgetSrc = `${ssoBase}/js/gauth-widget.js?20230127`;

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

    const tryConsumeTicket = (data: unknown) => {
      const payload = (data ?? {}) as GAuthPayload;
      const ticket = payload.serviceTicket;
      if (!ticket) return false;
      const serviceUrl =
        typeof payload.serviceUrl === 'string' && payload.serviceUrl ? payload.serviceUrl : null;
      submitTicket(String(ticket), serviceUrl);
      return true;
    };

    // Fallback channel: catch postMessages directly off the window in case the
    // gauth-widget origin filter rejects them. Garmin's iframe sometimes posts
    // a {status:'SUCCESS', serviceTicket, serviceUrl} envelope that the widget
    // event bus drops if the parent_url template var was empty server-side.
    const rawMessageListener = (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !event.origin.includes('garmin.')) return;
      let parsed: unknown = event.data;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return;
        }
      }
      tryConsumeTicket(parsed);
    };
    window.addEventListener('message', rawMessageListener);

    const script = document.createElement('script');
    script.src = widgetSrc;
    script.async = true;
    script.onerror = () => {
      setError('无法加载 Garmin 登录脚本（被网络拦截或 Garmin 不可达）。请检查网络后重试。');
    };
    let disposed = false;
    let widgetCleanup: (() => void) | null = null;
    script.onload = () => {
      if (disposed) return;
      const win = window;
      if (!win.GAUTH || !win.GAUTH_Events) {
        setError('Garmin 小组件未加载，请刷新重试');
        return;
      }

      const getAuthFrame = () =>
        widgetRootRef.current?.querySelector<HTMLIFrameElement>('iframe.gauth-iframe, iframe') ??
        null;

      const makeIframeVisible = () => {
        const frame = getAuthFrame();
        if (!frame) return false;
        if (!frame.style.height || frame.style.height === '0px') {
          frame.style.height = '760px';
        }
        frame.style.width = '100%';
        frame.style.maxWidth = '100%';
        frame.style.border = '0';
        frame.style.background = 'white';
        return true;
      };

      const ensureWidgetLoaded = () => {
        if (getAuthFrame()) {
          makeIframeVisible();
          return;
        }
        setStatusMessage('正在加载 Garmin 官方登录表单…', 'info');
        win.GAUTH?.loadGAuth();
      };

      const listeners: Array<[string, GAuthHandler]> = [];
      const addListener = (name: string, handler: GAuthHandler) => {
        listeners.push([name, handler]);
        win.GAUTH_Events?.addListener(name, handler);
      };

      addListener('MESSAGE-POSTED', (_e, d) => {
        const detail = d as GAuthPayload | null;
        if (detail?.gauthInitHeight) {
          const frame = getAuthFrame();
          if (frame) {
            frame.style.height = `${Number(detail.gauthInitHeight) + 20}px`;
            makeIframeVisible();
          }
          setStatusMessage('Garmin 官方登录表单已加载，请直接在下方完成登录', 'info');
          return;
        }
        if (detail?.openLiteBox) {
          setStatusMessage('Garmin 打开了附加验证，请按官方页面继续', 'warning');
          return;
        }
        tryConsumeTicket(detail);
      });
      addListener('SUCCESS', (_e, d) => {
        tryConsumeTicket(d);
      });
      addListener('AUTHENTICATED', (_e, d) => {
        tryConsumeTicket(d);
      });
      addListener('FAIL', () => {
        setStatusMessage('账号或密码错误，请在下方表单中重新输入', 'danger');
      });
      addListener('ACCOUNT_LOCKED', () => {
        setStatusMessage('Garmin 账号被暂时锁定，请稍后再试', 'danger');
      });
      addListener('ACCOUNT_DISABLED', () => {
        setStatusMessage('Garmin 账号不可用，请先在官方页面确认账号状态', 'danger');
      });
      addListener('ERROR', (_e, d) => {
        const payload = d as GAuthPayload | null;
        const detail = payload?.errorDetails || payload?.status || '未知错误';
        if (detail === 'Network error') return;
        setStatusMessage(`Garmin 登录组件异常：${String(detail)}`, 'danger');
      });

      const observer = new MutationObserver(() => {
        makeIframeVisible();
      });
      if (widgetRootRef.current) {
        observer.observe(widgetRootRef.current, { childList: true, subtree: true });
      }

      // Mode C from gauth-widget.js docs (line 174-186):
      //   no `redirectAfterAccountLoginUrl` + `consumeServiceTicket: false`
      //   → widget posts {status:'SUCCESS', serviceTicket, serviceUrl} to parent
      //
      // Mode A (`redirectAfterAccountLoginUrl: sso/embed`) traps the iframe in
      // an infinite `sso/embed?ticket=...` recursion (the embed.html page
      // re-runs the widget and redirects itself), so the parent never gets the
      // ticket. Backend dynamically uses the `serviceUrl` Garmin returns as
      // `login-url` for the OAuth1 exchange — that's why we forward it.
      win.GAUTH.init({
        gauthHost: ssoBase,
        clientId: 'GarminConnect',
        locale: region === 'cn' ? 'zh_CN' : 'en_US',
        id: 'gauth-widget',
        rememberMeShown: false,
        rememberMeChecked: false,
        createAccountShown: true,
        openCreateAccount: false,
        displayNameShown: false,
        consumeServiceTicket: false,
        initialFocus: true,
        embedWidget: false,
        socialEnabled: false,
        generateExtraServiceTicket: false,
        generateTwoExtraServiceTickets: false,
        generateNoServiceTicket: false,
        globalOptInShown: false,
        globalOptInChecked: false,
        mobile: false,
        connectLegalTerms: false,
        showTermsOfUse: false,
        showPrivacyPolicy: false,
        showConnectLegalAge: false,
        locationPromptShown: false,
        showPassword: true,
        useCustomHeader: false,
        mfaRequired: false,
        performMFACheck: false,
        permanentMFA: false,
        rememberMyBrowserShown: false,
        rememberMyBrowserChecked: false,
      });

      ensureWidgetLoaded();
      const heightTimer = window.setTimeout(() => {
        if (!makeIframeVisible()) ensureWidgetLoaded();
      }, 1500);
      const slowTimer = window.setTimeout(() => {
        if (!getAuthFrame() && !submitted.current) {
          setStatusMessage('Garmin 登录表单加载较慢，请稍等或刷新重试', 'warning');
        }
      }, 5000);

      widgetCleanup = () => {
        window.clearTimeout(heightTimer);
        window.clearTimeout(slowTimer);
        observer.disconnect();
        for (const [name, handler] of listeners) {
          win.GAUTH_Events?.removeListener?.(name, handler);
        }
      };
    };

    document.body.appendChild(script);

    return () => {
      // Avoid double-init on hot reload
      disposed = true;
      initialized.current = false;
      widgetCleanup?.();
      window.removeEventListener('message', rawMessageListener);
      script.remove();
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
