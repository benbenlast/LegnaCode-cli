/**
 * OML Design Prompt — Frontend/Design intent detection + layered design guidelines.
 * Extracted from Anthropic's Claude Design System Prompt.
 * Injected transparently via magicKeywords when frontend intent is detected.
 */

type FrontendIntent = 'none' | 'ui' | 'prototype' | 'design-exploration'

const UI_KEYWORDS = [
  // English
  'react', 'vue', 'svelte', 'angular', 'html', 'css', 'scss', 'tailwind',
  'component', 'layout', 'landing page', 'form', 'button', 'modal',
  'navbar', 'sidebar', 'card', 'table', 'dashboard', 'header', 'footer',
  'dropdown', 'tooltip', 'carousel', 'grid', 'flexbox', 'responsive',
  'frontend', 'front-end', 'web page', 'webpage', 'website', 'ui',
  // Chinese — require more specific compound terms to avoid false positives
  '前端开发', '前端组件', 'UI组件', 'UI设计',
  '页面布局', '页面设计', '网页设计', '响应式布局',
  // Japanese
  'コンポーネント', 'レイアウト', 'フロントエンド', 'ページ',
]

const PROTOTYPE_KEYWORDS = [
  'prototype', 'prototyp', 'interactive', 'animation', 'animate',
  'transition', 'demo', 'mockup', 'mock-up', 'wireframe',
  '原型', '交互', '动画', '演示',
  'プロトタイプ', 'アニメーション', 'インタラクティブ',
]

const DESIGN_EXPLORATION_KEYWORDS = [
  'design system', 'design exploration', 'design variations',
  'color scheme', 'color palette', 'typography', 'ui/ux', 'ux',
  'variations', 'alternatives', 'options', 'concepts',
  '设计稿', '设计探索', '配色', '设计方案', '风格', '设计系统',
  'デザインシステム', 'カラーパレット', 'バリエーション',
]

/** Detect frontend/design intent from user input */
export function detectFrontendIntent(input: string): FrontendIntent {
  const lower = input.toLowerCase()

  // Check highest specificity first
  if (DESIGN_EXPLORATION_KEYWORDS.some(k => lower.includes(k))) return 'design-exploration'
  if (PROTOTYPE_KEYWORDS.some(k => lower.includes(k))) return 'prototype'
  if (UI_KEYWORDS.some(k => lower.includes(k))) return 'ui'

  return 'none'
}

// --- Layered design prompts ---

const UI_PROMPT = `You are an expert frontend developer and designer. Follow these principles:

COLOR & VISUAL:
- Use oklch color space for perceptually uniform, harmonious palettes
- Brand color first, derive accent/neutral from it via hue rotation
- Ensure WCAG AA contrast (4.5:1 text, 3:1 large text/UI)
- Use subtle gradients and shadows for depth, not flat blocks

ARCHITECTURE:
- Component-first: each piece has a single responsibility
- Responsive by default — mobile-first, then scale up
- Semantic HTML: nav, main, section, article, aside, footer
- ARIA labels on interactive elements, keyboard navigable

STYLE:
- Consistent spacing scale (4px base: 4, 8, 12, 16, 24, 32, 48)
- Typography hierarchy: max 2 font families, clear size scale
- Avoid generic web design tropes unless explicitly making a web page
- Every visual choice should serve the content, not decorate it`

const PROTOTYPE_PROMPT = `${UI_PROMPT}

INTERACTION & ANIMATION:
- CSS transitions for simple state changes (hover, focus, toggle)
- requestAnimationFrame for complex/physics-based animations
- Target 60fps — avoid layout thrashing, use transform/opacity
- Meaningful motion: animations should communicate state changes
- Easing: ease-out for entrances, ease-in for exits, ease-in-out for moves
- Keep durations short: 150-300ms for micro-interactions, 300-500ms for transitions
- Center interactive prototypes in viewport, make them responsive
- Use localStorage to persist user state across reloads`

const DESIGN_EXPLORATION_PROMPT = `${PROTOTYPE_PROMPT}

DESIGN EXPLORATION:
- Produce 3+ distinct variations, ranging from conservative to experimental
- Explore multiple dimensions: color, layout, interaction, iconography, typography
- Each variation must include a brief rationale explaining design decisions
- Use placeholder content (lorem ipsum, geometric shapes) over low-quality assets
- Push creative boundaries with CSS/HTML/SVG — gradients, clip-path, blend modes
- Consider emotional tone: playful vs professional, minimal vs rich, warm vs cool
- Show how each variation scales across breakpoints (mobile → desktop)`

/** Get the design prompt for a detected intent level */
export function getDesignPrompt(intent: 'ui' | 'prototype' | 'design-exploration'): string {
  switch (intent) {
    case 'ui': return UI_PROMPT
    case 'prototype': return PROTOTYPE_PROMPT
    case 'design-exploration': return DESIGN_EXPLORATION_PROMPT
  }
}
