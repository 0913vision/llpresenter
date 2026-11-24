import './selectionDrag.css';

export function selectionLabel(label: string, count: number): string {
  return count > 1 ? `${count}개 ${label}` : label;
}

/** Returns cleanup for the native drag image; the caller releases it on drag end. */
export function selectionDragImage(
  transfer: DataTransfer,
  source: HTMLElement,
  count: number,
): () => void {
  const image = document.createElement('div');
  image.className = 'selection-drag';
  const title = document.createElement('span');
  title.textContent = source.getAttribute('aria-label') ?? source.textContent;
  const badge = document.createElement('span');
  badge.className = 'selection-drag__count';
  badge.textContent = String(count);
  image.append(title, badge);
  document.body.append(image);
  transfer.setDragImage(image, 0, 0);
  return () => image.remove();
}
