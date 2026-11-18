const NEAR_MARGIN = 200;

function scrollParent(node: Element): HTMLElement | null {
  let parent = node.parentElement;
  while (parent !== null) {
    if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
}

function near(node: Element): boolean {
  // NOTE(0913vision): A picture out of the layout (a hidden tab) or drawn
  // ahead out of sight is not part of what the frame shows.
  if (node.getClientRects().length === 0) return false;
  if (node.closest('[data-drawing-ahead]') !== null) return false;
  const rect = node.getBoundingClientRect();
  const clip = scrollParent(node)?.getBoundingClientRect();
  const top = clip?.top ?? 0;
  const bottom = clip?.bottom ?? window.innerHeight;
  return rect.bottom >= top - NEAR_MARGIN && rect.top <= bottom + NEAR_MARGIN;
}

/**
 * How many pictures the frame shows in and next to its views when all of them
 * are drawn, or -1 while any is still drawing.
 */
export function drawnPictures(root: HTMLElement): number {
  if ([...root.querySelectorAll('[data-picture-staging]')].some(near)) {
    return -1;
  }
  const pictures = [
    ...root.querySelectorAll<HTMLElement>('[data-preview-ready]'),
  ].filter(near);
  if (pictures.some(picture => picture.dataset['previewReady'] !== 'true')) {
    return -1;
  }
  const images = [...root.querySelectorAll('img')].filter(near);
  if (images.some(image => !image.complete)) return -1;
  return pictures.length + images.length;
}
