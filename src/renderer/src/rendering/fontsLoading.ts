/** Whether the document's font set is still loading, when it is available. */
export function fontsLoading(fonts: FontFaceSet | undefined): boolean {
  return fonts?.status === 'loading';
}

/** What a drawing used of the font set: how many faces it had and its state. */
export function fontsStamp(fonts: FontFaceSet | undefined): string {
  return fonts === undefined ? '' : `${fonts.size}:${fonts.status}`;
}

/** Checks readiness when the renderer provides it. */
export function previewReady(renderer: {ready?: () => boolean}): boolean {
  return renderer.ready?.() ?? true;
}
