export async function pickFolder(): Promise<string | null> {
  const w = window as unknown as { pixelForge?: { pickFolder?: () => Promise<string | null>; isElectron?: boolean } }
  if (w.pixelForge?.pickFolder) {
    const p = await w.pixelForge.pickFolder()
    return p || null
  }

  return null
}
