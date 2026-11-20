const sources = new Map<string, string>();

/** Capture the native presenter window outside the presenter's render loop. */
export function setDesktopPreviewSource(
  screenId: string,
  source: string,
): void {
  sources.set(screenId, source);
}

export function desktopPreviewSource(screenId: string): string | undefined {
  return sources.get(screenId);
}

export function clearDesktopPreviewSource(
  screenId: string,
  source: string,
): void {
  if (sources.get(screenId) === source) sources.delete(screenId);
}
