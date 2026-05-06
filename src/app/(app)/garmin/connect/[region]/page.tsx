'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

declare global {
  interface Window {
    GAUTH?: {
      init: (config: Record<string, unknown>) => void;
      loadGAuth: () => void;
      checkAuthentication: () => void;
    };
    GAUTH_Events?: {
      addListener: (event: string, handler: (e: unknown, data?: any) => void) => void;
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
  const [tone, setTone] = useState<'info' | 'warning' | 'danger' | 'success'>('info');
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const submitted = useRef(false);

  function setStatusMessage(message: string, t: typeof tone = 'info') {
    setStatus(message);
    setTone(t);
  }

  useEffect(() => {
    if (!region) {
      setError('无效区域，请回到上一页重新选择');
      return;
    }
    if (initialized.current) return;
    initialized.current = true;

    const ssoBase = region === 'cn' ? 'https://sso.garmin.cn/sso' : 'https://sso.garmin.com/sso';
    const ssoEmbed = `${ssoBase}/embed`;
    const widgetSrc = `${ssoBase}/js/gauth-widget.js?20230127`;

    const submitTicket = async (ticket: string) => {
      if (submitted.current) return;
      submitted.current = true;
      setStatusMessage('登录成功，正在与服务器绑定…', 'success');
      try {
        const res = await fetch(`${API_URL}/api/garmin/callback/${region}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          profile?: { fullName?: string; userName?: string };
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || '绑定失败，请稍后重试');
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

    const onTicket = (data: any) => {
      const ticket = data?.serviceTicket;
      if (ticket) submitTicket(String(ticket));
    };

    const script = document.createElement('script');
    script.src = widgetSrc;
    script.async = true;
    script.onerror = () => {
      setError('无法加载 Garmin 登录脚本（被网络拦截或 Garmin 不可达）。请检查网络后重试。');
    };
    script.onload = () => {
      const win = window;
      if (!win.GAUTH || !win.GAUTH_Events) {
        setError('Garmin 小组件未加载，请刷新重试');
        return;
      }

      win.GAUTH_Events.addListener('MESSAGE-POSTED', (_e, d) => {
        if (d?.gauthInitHeight) {
          const frame = document.querySelector<HTMLIFrameElement>(
            'iframe.gauth-iframe, #gauth-widget iframe',
          );
          if (frame) {
            frame.style.height = `${Number(d.gauthInitHeight) + 20}px`;
            frame.style.width = '100%';
            frame.style.border = '0';
          }
          setStatusMessage('Garmin 官方登录表单已加载，请直接在下方完成登录', 'info');
        } else if (d?.status === 'SUCCESS') {
          onTicket(d);
        } else if (d?.openLiteBox) {
          setStatusMessage('Garmin 打开了附加验证，请按官方页面继续', 'warning');
        }
      });
      win.GAUTH_Events.addListener('AUTHENTICATED', (_e, d) => onTicket(d));
      win.GAUTH_Events.addListener('SUCCESS', (_e, d) => onTicket(d));
      win.GAUTH_Events.addListener('FAIL', () => {
        setStatusMessage('账号或密码错误，请在下方表单中重新输入', 'danger');
      });
      win.GAUTH_Events.addListener('ACCOUNT_LOCKED', () => {
        setStatusMessage('Garmin 账号被暂时锁定，请稍后再试', 'danger');
      });
      win.GAUTH_Events.addListener('ACCOUNT_DISABLED', () => {
        setStatusMessage('Garmin 账号不可用，请先在官方页面确认账号状态', 'danger');
      });
      win.GAUTH_Events.addListener('ERROR', (_e, d: any) => {
        const detail = d?.errorDetails || d?.status || '未知错误';
        // "Network error" before login is normal — Garmin probes for an
        // existing session and refuses cross-origin without auth. Don't
        // show as fatal; the widget will still render the form.
        if (detail === 'Network error') return;
        setStatusMessage(`Garmin 登录组件异常：${detail}`, 'danger');
      });

      win.GAUTH.init({
        gauthHost: ssoBase,
        clientId: 'GarminConnect',
        locale: region === 'cn' ? 'zh_CN' : 'en_US',
        id: 'gauth-widget',
        target: ssoEmbed,
        redirectAfterAccountLoginUrl: ssoEmbed,
        redirectAfterAccountCreationUrl: ssoEmbed,
        rememberMeShown: false,
        rememberMeChecked: false,
        createAccountShown: true,
        openCreateAccount: false,
        displayNameShown: false,
        consumeServiceTicket: true,
        initialFocus: true,
        embedWidget: true,
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

      win.GAUTH.checkAuthentication();
      // Force-load the form if Garmin's session probe doesn't trigger one
      setTimeout(() => {
        if (!document.querySelector('#gauth-widget iframe')) {
          win.GAUTH?.loadGAuth();
        }
      }, 1500);
    };

    document.body.appendChild(script);

    return () => {
      // Avoid double-init on hot reload
      script.remove();
    };
  }, [region, router]);

  const toneClass = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }[tone];

  const regionLabel = region === 'cn' ? '国区 (garmin.cn)' : region === 'global' ? '国际区 (garmin.com)' : '';

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <Link href="/garmin" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← 返回
          </Link>
          <h1 className="text-2xl font-bold mt-2">连接 {regionLabel} Garmin</h1>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
            下方登录表单由 Garmin 官方的 <span className="font-mono">sso.garmin.{region === 'cn' ? 'cn' : 'com'}</span> 直接渲染。账号密码只发到 Garmin，不会经过我们的服务器。
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
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
          id="gauth-widget"
          className="bg-white border border-zinc-200 rounded-2xl p-2 min-h-[640px]"
        />
      </div>
    </main>
  );
}
