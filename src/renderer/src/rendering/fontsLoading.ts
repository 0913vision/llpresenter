/** Whether the document's font set is still loading, when it is available. */
export function fontsLoading(fonts: FontFaceSet | undefined): boolean {
  return fonts?.status === 'loading';
}

/** Checks readiness when the renderer provides it. */
export function previewReady(renderer: {ready?: () => boolean}): boolean {
  return renderer.ready?.() ?? true;
}
