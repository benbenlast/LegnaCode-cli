import { getInitialSettings } from './settings/settings.js'
import { getSystemLocaleLanguage } from './intl.js'
import { ZH_DICT } from './i18n/zh.js'

let cachedIsChinese: boolean | null = null

const CHINESE_PATTERNS = /^(chinese|zh|zh-cn|zh-tw|zh-hk|中文|简体中文|繁體中文)$/i

export function isChinese(): boolean {
  if (cachedIsChinese !== null) return cachedIsChinese
  try {
    const lang = getInitialSettings().language
    if (lang) {
      cachedIsChinese = CHINESE_PATTERNS.test(lang.trim())
      return cachedIsChinese
    }
  } catch {
    // settings not available yet
  }
  try {
    const sysLang = getSystemLocaleLanguage()
    cachedIsChinese = sysLang === 'zh'
  } catch {
    cachedIsChinese = false
  }
  return cachedIsChinese
}

export function resetI18nCache(): void {
  cachedIsChinese = null
}

export function t(key: string): string {
  if (!isChinese()) return key
  return ZH_DICT[key] ?? key
}

export function tf(key: string, ...args: string[]): string {
  let result = t(key)
  for (let i = 0; i < args.length; i++) {
    result = result.replace(`{${i}}`, args[i]!)
  }
  return result
}
