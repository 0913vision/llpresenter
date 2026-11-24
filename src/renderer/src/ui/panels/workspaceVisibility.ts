/** The kept workspace frame, if this element belongs to one. */
export function workspaceFrame(element: Element): Element | null {
  return element.closest('[data-workspace-frame]');
}

/** Whether a kept frame is currently hidden behind the active workspace. */
export function isHiddenWorkspace(frame: Element | null): boolean {
  return frame?.getAttribute('aria-hidden') === 'true';
}

/** Recheck deferred measurements when a kept frame becomes visible. */
export function onWorkspaceVisible(
  frame: Element | null,
  run: () => void,
): () => void {
  if (frame === null || typeof MutationObserver === 'undefined') {
    return () => undefined;
  }
  const observer = new MutationObserver(() => {
    if (!isHiddenWorkspace(frame)) run();
  });
  observer.observe(frame, {attributes: true, attributeFilter: ['aria-hidden']});
  return () => observer.disconnect();
}
