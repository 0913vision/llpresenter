/** Coalesces expensive layout reads until a window or panel resize settles. */
let panelResizing = false;
let windowResizing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function isLayoutResizeActive(): boolean {
  return panelResizing || windowResizing;
}

function release(): void {
  if (isLayoutResizeActive()) return;
  delete document.documentElement.dataset['layoutResizing'];
  for (const listener of listeners) listener();
}

export function beginLayoutResize(): void {
  panelResizing = true;
  document.documentElement.dataset['layoutResizing'] = '';
}

export function endLayoutResize(): void {
  if (!panelResizing) return;
  panelResizing = false;
  release();
}

/** Register a refresh for changes skipped during resizing. */
export function onLayoutResizeEnd(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function onWindowResize(): void {
  windowResizing = true;
  document.documentElement.dataset['layoutResizing'] = '';
  clearTimeout(timer);
  timer = setTimeout(() => {
    windowResizing = false;
    release();
  }, 150);
}

/** Releases the window listener and any pending resize work. */
export function disposeLayoutResize(): void {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('pagehide', disposeLayoutResize);
  clearTimeout(timer);
  timer = undefined;
  panelResizing = false;
  windowResizing = false;
  listeners.clear();
  delete document.documentElement.dataset['layoutResizing'];
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('pagehide', disposeLayoutResize, {once: true});
}
