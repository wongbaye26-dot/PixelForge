import type { LibraryView } from '@/stores/ui'

export const ENABLE_AI = true
export const ENABLE_OCR = true
export const ENABLE_TEMPLATE = true
export const ENABLE_TRASH = true

export const featureFlags = Object.freeze({
  ENABLE_AI,
  ENABLE_OCR,
  ENABLE_TEMPLATE,
  ENABLE_TRASH,
})

export function isLibraryViewEnabled(view: LibraryView): boolean {
  if (view === 'ai') return ENABLE_AI
  if (view === 'ocr') return ENABLE_OCR
  if (view === 'trash') return ENABLE_TRASH
  if (
    view === 'template_my' ||
    view === 'template_common' ||
    view === 'template_social' ||
    view === 'template_ecommerce' ||
    view === 'template_custom'
  ) {
    return ENABLE_TEMPLATE
  }
  return true
}
