export async function pickFolder(): Promise<string | null> {
  const w = window as unknown as { pixelForge?: { pickFolder?: () => Promise<string | null>; isElectron?: boolean } }
  if (w.pixelForge?.pickFolder) {
    const p = await w.pixelForge.pickFolder()
    return p || null
  }

  const tw = window as any
  const open = tw?.__TAURI__?.dialog?.open
  if (typeof open === 'function') {
    const picked = await open({ directory: true, multiple: false })
    if (!picked) return null
    if (Array.isArray(picked)) return picked[0] ?? null
    return picked
  }

  return null
}
