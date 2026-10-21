import { ref } from 'vue'
import { translationEntries } from './messages.generated'

export type Locale = 'en' | 'zh-TW' | 'zh-CN'

export const localeOptions = [
  { label: 'English', value: 'en' as const },
  { label: '繁體中文', value: 'zh-TW' as const },
  { label: '简体中文', value: 'zh-CN' as const },
]

const localeStorageKey = 'codex-proxy-rs-locale'
export const locale = ref<Locale>(readInitialLocale())
const localeLabelEntries: readonly (readonly [string, string, string])[] = [
  ['繁體中文', 'Traditional Chinese', '繁體中文'],
  ['简体中文', 'Simplified Chinese', '简體中文'],
  ['界面语言', 'Interface language', '介面語言'],
  ['切换语言', 'Switch language', '切換語言'],
] as const
const translationMaps: Record<'en' | 'zh-TW', Map<string, string>> = {
  'en': new Map<string, string>([
    ...translationEntries.map(([source, english]) => [source, english] as [string, string]),
    ...localeLabelEntries.map(([source, english]) => [source, english] as [string, string]),
  ]),
  'zh-TW': new Map<string, string>([
    ...translationEntries.map(([source, , traditional]) => [source, traditional] as [string, string]),
    ...localeLabelEntries.map(([source, , traditional]) => [source, traditional] as [string, string]),
  ]),
}
const orderedTranslations = {
  'en': [...translationMaps.en.entries()].sort(([left], [right]) => right.length - left.length),
  'zh-TW': [...translationMaps['zh-TW'].entries()].sort(([left], [right]) => right.length - left.length),
}
const textRecords = new WeakMap<Text, { source: string, rendered: string }>()
const attributeRecords = new WeakMap<Element, Map<string, { source: string, rendered: string }>>()
let observer: MutationObserver | undefined
let translating = false

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'zh-TW' || value === 'zh-CN'
}

function readInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(localeStorageKey)
      if (isLocale(saved))
        return saved
    }
    catch {
      // 浏览器禁用本地存储时回退到浏览器语言
    }

    const browserLocale = navigator.language.toLowerCase()
    if (browserLocale.startsWith('zh-tw') || browserLocale.startsWith('zh-hk') || browserLocale.startsWith('zh-mo'))
      return 'zh-TW'
    if (browserLocale.startsWith('zh'))
      return 'zh-CN'
  }
  return 'en'
}

function translateSource(source: string, target: Locale): string {
  if (target === 'zh-CN' || !source)
    return source

  let translated = source
  for (const [from, to] of orderedTranslations[target]) {
    if (translated.includes(from))
      translated = translated.replaceAll(from, to)
  }
  return translated
}

function isIgnoredTextNode(node: Text): boolean {
  return Boolean(node.parentElement?.closest('script, style, textarea, input, pre, code, [data-i18n-ignore]'))
}

function translateTextNode(node: Text): void {
  if (isIgnoredTextNode(node))
    return

  const current = node.data
  const previous = textRecords.get(node)
  const source = previous && current === previous.rendered ? previous.source : current
  const rendered = translateSource(source, locale.value)
  textRecords.set(node, { source, rendered })
  if (rendered === current)
    return

  translating = true
  node.data = rendered
  translating = false
}

function translateAttribute(element: Element, name: string): void {
  const current = element.getAttribute(name)
  const records = attributeRecords.get(element) ?? new Map<string, { source: string, rendered: string }>()
  const previous = records.get(name)

  if (current == null) {
    records.delete(name)
    return
  }

  const source = previous && current === previous.rendered ? previous.source : current
  const rendered = translateSource(source, locale.value)
  records.set(name, { source, rendered })
  attributeRecords.set(element, records)
  if (rendered === current)
    return

  translating = true
  element.setAttribute(name, rendered)
  translating = false
}

function translateElement(element: Element): void {
  if (element.matches('script, style, pre, code, [data-i18n-ignore]'))
    return

  for (const name of ['aria-label', 'title', 'placeholder', 'alt'])
    translateAttribute(element, name)
}

function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text)
  }
  else if (root.nodeType === Node.ELEMENT_NODE) {
    const element = root as Element
    translateElement(element)
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Node | null = walker.nextNode()
    while (node) {
      translateTextNode(node as Text)
      node = walker.nextNode()
    }
    element.querySelectorAll('*').forEach(translateElement)
  }
}

function translateDocument(): void {
  if (typeof document === 'undefined')
    return

  document.documentElement.lang = locale.value
  translateTree(document.body)
}

export function translateText(source: string): string {
  return translateSource(source, locale.value)
}

export function useLocale() {
  function setLocale(nextLocale: Locale): void {
    if (locale.value === nextLocale)
      return
    locale.value = nextLocale
    try {
      window.localStorage.setItem(localeStorageKey, nextLocale)
    }
    catch {
      // 浏览器禁用本地存储时仍保持当前页面语言
    }
    translateDocument()
  }

  function cycleLocale(): void {
    const currentIndex = localeOptions.findIndex(option => option.value === locale.value)
    setLocale(localeOptions[(currentIndex + 1) % localeOptions.length].value)
  }

  return { locale, localeOptions, setLocale, cycleLocale, translateText }
}

export function installI18n(): void {
  if (typeof document === 'undefined' || observer)
    return

  translateDocument()
  observer = new MutationObserver((mutations) => {
    if (translating)
      return

    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        translateTextNode(mutation.target as Text)
      }
      else {
        mutation.addedNodes.forEach(translateTree)
        if (mutation.type === 'attributes')
          translateAttribute(mutation.target as Element, mutation.attributeName ?? '')
      }
    }
  })
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'],
  })
}
