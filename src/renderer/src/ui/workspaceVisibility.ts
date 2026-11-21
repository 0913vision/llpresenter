/** The kept workspace frame, if this element belongs to one. */
export function workspaceFrame(element: Element): Element | null {
  return element.closest('[data-slide-grid-cache], [data-workspace-frame]');
}

/** Whether a kept frame is currently hidden behind the active workspace. */
export function isHiddenWorkspace(frame: Element | null): boolean {
  return (
    frame?.closest(
      '[data-slide-grid-cache][aria-hidden="true"], [data-workspace-frame][aria-hidden="true"]',
    ) !== null && frame !== null
  );
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
  let current: Element | null = frame;
  while (current !== null) {
    if (current.matches('[data-slide-grid-cache], [data-workspace-frame]')) {
      observer.observe(current, {
        attributes: true,
        attributeFilter: ['aria-hidden'],
      });
    }
    current = current.parentElement;
  }
  return () => observer.disconnect();
}
