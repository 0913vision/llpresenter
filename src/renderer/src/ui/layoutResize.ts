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

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    windowResizing = true;
    document.documentElement.dataset['layoutResizing'] = '';
    clearTimeout(timer);
    timer = setTimeout(() => {
      windowResizing = false;
      release();
    }, 150);
  });
}
