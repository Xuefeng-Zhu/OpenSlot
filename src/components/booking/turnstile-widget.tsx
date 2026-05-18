"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TurnstileWidgetProps {
  action: string;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
  className?: string;
}

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions
  ) => string;
  remove?: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/**
 * Renders the optional Cloudflare Turnstile challenge when a public site key is
 * configured. Missing site keys intentionally render nothing.
 */
export function TurnstileWidget({
  action,
  onTokenChange,
  resetKey = 0,
  className,
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) {
      return;
    }

    if (widgetIdRef.current && window.turnstile.remove) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    onTokenChange(null);
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(null),
      "error-callback": () => onTokenChange(null),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onTokenChange, resetKey, scriptReady, siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className={cn("flex min-h-[65px] justify-center", className)}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </div>
  );
}
