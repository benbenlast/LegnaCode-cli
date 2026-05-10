/**
 * LegnaCode Office — Server-side i18n
 *
 * Provides state label translations for API responses and hook event formatting.
 * Mirrors the webview-ui i18n keys but only includes server-relevant strings.
 */

export type Locale = 'zh' | 'en';

export interface ServerStrings {
  states: Record<string, string>;
  roles: Record<string, string>;
}

const zh: ServerStrings = {
  states: {
    idle: '待命中',
    writing: '编码中',
    researching: '搜索中',
    executing: '执行中',
    syncing: '同步中',
    error: '出错了',
    thinking: '思考中',
    waitingInput: '等待输入',
  },
  roles: {
    user: '用户',
    assistant: '助手',
    tool: '工具',
  },
};

const en: ServerStrings = {
  states: {
    idle: 'Idle',
    writing: 'Writing',
    researching: 'Researching',
    executing: 'Executing',
    syncing: 'Syncing',
    error: 'Error',
    thinking: 'Thinking',
    waitingInput: 'Waiting for input',
  },
  roles: {
    user: 'User',
    assistant: 'Assistant',
    tool: 'Tool',
  },
};

const locales: Record<Locale, ServerStrings> = { zh, en };

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(): ServerStrings {
  return locales[currentLocale];
}

export function stateLabel(state: string): string {
  return locales[currentLocale].states[state] ?? state;
}
