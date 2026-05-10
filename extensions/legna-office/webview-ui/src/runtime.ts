/**
 * Runtime detection, provider-agnostic
 *
 * Single source of truth for determining whether the webview is running
 * inside an IDE extension (VS Code, Cursor, Windsurf, etc.), standalone
 * in a browser, or embedded in the LegnaCode Admin WebUI.
 */

declare function acquireVsCodeApi(): unknown;

declare global {
  interface Window {
    __LEGNA_OFFICE_CONFIG__?: { wsUrl?: string };
  }
}

type Runtime = 'vscode' | 'browser' | 'legna-admin';

function detectRuntime(): Runtime {
  // LegnaCode Admin embeds the office panel with a global config marker
  if (typeof window !== 'undefined' && window.__LEGNA_OFFICE_CONFIG__) {
    return 'legna-admin';
  }
  // URL param override for admin iframe/embed scenarios
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('legna-admin')) {
    return 'legna-admin';
  }
  if (typeof acquireVsCodeApi !== 'undefined') {
    return 'vscode';
  }
  return 'browser';
}

export const runtime = detectRuntime();
export const isBrowserRuntime = runtime === 'browser' || runtime === 'legna-admin';
export const isLegnaAdminRuntime = runtime === 'legna-admin';
export const isVSCodeRuntime = runtime === 'vscode';
