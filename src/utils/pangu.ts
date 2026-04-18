/**
 * Pangu spacing — insert spaces between CJK and ASCII characters.
 * Ported from AtomCode's CJK typographic enhancement.
 * Applied at render time only, never modifies source content.
 */

const CJK = '\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3040-\\u309f\\u30a0-\\u30ff\\u3100-\\u312f\\u3200-\\u32ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f'

const RE_CJK_LEFT = new RegExp(`([${CJK}])([A-Za-z0-9\\(\\[\\{])`, 'g')
const RE_CJK_RIGHT = new RegExp(`([A-Za-z0-9\\)\\]\\}])([${CJK}])`, 'g')

export function panguSpacing(text: string): string {
  return text.replace(RE_CJK_LEFT, '$1 $2').replace(RE_CJK_RIGHT, '$1 $2')
}
