import {Component, createRef, type ReactNode} from 'react';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import styles from './HeldFrame.module.css';

const NEAR_MARGIN = 200;

/** What a frame shows; a change holds the previous picture. */
export interface FrameHold {
  readonly identity: string;
  /** False while the frame passes through states on the way to `identity`. */
  readonly settled: boolean;
}

interface HeldCopy {
  readonly copy: HTMLElement;
  readonly scrolls: ReadonlyArray<readonly [HTMLElement, number, number]>;
}

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
function drawnPictures(root: HTMLElement): number {
  if (root.querySelector('[data-picture-staging]') !== null) return -1;
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

/** The look focus and the pointer give an element and its decorations. */
const STATE_LOOK = [
  'outline-color',
  'outline-style',
  'outline-width',
  'outline-offset',
  'box-shadow',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'background-color',
  'color',
  'opacity',
];

/**
 * Gives the copy of an element the look focus or the pointer gives the
 * element, which a copy out of focus and out of the pointer's reach loses.
 */
function keepLook(original: Element, twin: Element, rules: string[]): void {
  if (!(twin instanceof HTMLElement || twin instanceof SVGElement)) return;
  const style = getComputedStyle(original);
  const ring = original !== document.activeElement || ringShown === original;
  for (const name of STATE_LOOK) {
    if (!ring && name.startsWith('outline')) continue;
    twin.style.setProperty(name, style.getPropertyValue(name));
  }
  const mark = String(rules.length);
  twin.dataset['heldLook'] = mark;
  for (const pseudo of ['::before', '::after']) {
    const look = getComputedStyle(original, pseudo);
    const declarations = [...look]
      .map(name => `${name}:${look.getPropertyValue(name)}`)
      .join(';');
    rules.push(`[data-held-look="${mark}"]${pseudo}{${declarations}}`);
  }
}

function stillOf(video: HTMLVideoElement): HTMLCanvasElement {
  const still = document.createElement('canvas');
  still.className = video.className;
  still.style.cssText = video.style.cssText;
  still.width = video.videoWidth;
  still.height = video.videoHeight;
  try {
    still.getContext('2d')?.drawImage(video, 0, 0);
  } catch {
    return still;
  }
  return still;
}

let ringShown: Element | null = null;

/** Whether the element is in the state, false where the state is unknown. */
function inState(element: Element, state: string): boolean {
  try {
    return element.matches(state);
  } catch {
    return false;
  }
}

/**
 * Notes, a frame after each focus change, key press and press, which element
 * shows its focus ring on screen. A key press turns the ring of the focused
 * element on at once, but a change made in the same turn moves focus before
 * the ring is ever drawn, so the held copy follows the ring as last drawn.
 */
function followRings(): void {
  if (typeof window === 'undefined') return;
  const note = (): void => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      ringShown =
        active !== null && inState(active, ':focus-visible') ? active : null;
    });
  };
  for (const name of ['focusin', 'keydown', 'pointerdown']) {
    window.addEventListener(name, note, {capture: true});
  }
}
followRings();

/** The background the frame sits on, so its copy can cover it fully. */
function groundOf(node: HTMLElement): string {
  for (let at: HTMLElement | null = node; at !== null; at = at.parentElement) {
    const color = getComputedStyle(at).backgroundColor;
    if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
  }
  return '';
}

/** A still copy of the frame as it is now, scroll positions and values kept. */
function copyOf(root: HTMLElement): HeldCopy {
  const copy = root.cloneNode(true);
  if (!(copy instanceof HTMLElement)) return {copy: root, scrolls: []};
  const scrolls: Array<readonly [HTMLElement, number, number]> = [];
  const originals = [root, ...root.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  const replaced: Array<readonly [Element, Element]> = [];
  const looks: string[] = [];
  originals.forEach((original, index) => {
    const twin = copies[index];
    if (twin === undefined) return;
    if (inState(original, ':hover') || inState(original, ':focus-within')) {
      keepLook(original, twin, looks);
    }
    if (
      original instanceof HTMLElement &&
      twin instanceof HTMLElement &&
      (original.scrollTop !== 0 || original.scrollLeft !== 0)
    ) {
      scrolls.push([twin, original.scrollTop, original.scrollLeft]);
    }
    if (
      (original instanceof HTMLInputElement &&
        twin instanceof HTMLInputElement) ||
      (original instanceof HTMLTextAreaElement &&
        twin instanceof HTMLTextAreaElement) ||
      (original instanceof HTMLSelectElement &&
        twin instanceof HTMLSelectElement)
    ) {
      twin.value = original.value;
      if (
        original instanceof HTMLInputElement &&
        twin instanceof HTMLInputElement
      ) {
        twin.checked = original.checked;
      }
    } else if (
      original instanceof HTMLCanvasElement &&
      twin instanceof HTMLCanvasElement
    ) {
      try {
        twin.getContext('2d')?.drawImage(original, 0, 0);
      } catch {
        twin.dataset['unread'] = '';
      }
    } else if (original instanceof HTMLVideoElement) {
      replaced.push([twin, stillOf(original)]);
    }
  });
  for (const [twin, still] of replaced) twin.replaceWith(still);
  if (looks.length > 0) {
    const sheet = document.createElement('style');
    sheet.textContent = looks.join(' ');
    copy.append(sheet);
  }
  // NOTE(0913vision): Inert, so a focus move or a lookup made while the copy
  // shows reaches the live frame, never the copy before it.
  copy.setAttribute('inert', '');
  // NOTE(0913vision): Without ids, a lookup by id or a label reference finds
  // the live element, not its copy before it.
  for (const element of [copy, ...copy.querySelectorAll('[id]')]) {
    element.removeAttribute('id');
  }
  copy.setAttribute('aria-hidden', 'true');
  copy.dataset['heldCopy'] = '';
  return {copy, scrolls};
}

/**
 * Shows a frame's previous picture, unchanged, while what it shows changes,
 * until the new content and its pictures in and next to view are drawn, and
 * then the new content in one frame. A change never shows half drawn: no
 * empty tiles, no panel filling in after its neighbour.
 */
export class HeldFrame extends Component<{
  readonly hold: FrameHold;
  readonly children: ReactNode;
}> {
  private readonly live = createRef<HTMLDivElement>();
  private readonly cover = createRef<HTMLDivElement>();
  private held = false;
  private frame = 0;
  private started = 0;
  private settledCount = -1;

  override getSnapshotBeforeUpdate(previous: {
    readonly hold: FrameHold;
  }): HeldCopy | null {
    const node = this.live.current;
    if (
      this.held ||
      node === null ||
      previous.hold.identity === this.props.hold.identity
    ) {
      return null;
    }
    return copyOf(node);
  }

  override componentDidUpdate(
    _previous: unknown,
    _state: unknown,
    snapshot: HeldCopy | null,
  ): void {
    if (snapshot === null) return;
    const cover = this.cover.current;
    const live = this.live.current;
    if (cover === null || live === null) return;
    // NOTE(0913vision): An opaque cover keeps the copy's text smoothing the
    // same as the frame's; a see-through layer draws text in grey.
    cover.style.backgroundColor = groundOf(cover);
    cover.replaceChildren(snapshot.copy);
    for (const [node, top, left] of snapshot.scrolls) {
      node.scrollTop = top;
      node.scrollLeft = left;
    }
    live.style.opacity = '0';
    live.style.pointerEvents = 'none';
    this.held = true;
    this.settledCount = -1;
    this.started = performance.now();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.check);
  }

  override componentWillUnmount(): void {
    cancelAnimationFrame(this.frame);
    this.held = false;
  }

  private readonly check = (): void => {
    const live = this.live.current;
    if (!this.held || live === null) return;
    const expired =
      performance.now() - this.started >= OUTPUT_REVEAL_DEADLINE_MS;
    const count = this.props.hold.settled ? drawnPictures(live) : -1;
    // NOTE(0913vision): The frame shows once it stayed drawn through one
    // more frame with the same pictures: a grid that measures itself adds its
    // further rows after the frame that first looked complete.
    const steady = count >= 0 && count === this.settledCount;
    this.settledCount = count;
    if (!expired && !steady) {
      this.frame = requestAnimationFrame(this.check);
      return;
    }
    this.held = false;
    live.style.removeProperty('opacity');
    live.style.removeProperty('pointer-events');
    this.cover.current?.replaceChildren();
  };

  override render(): ReactNode {
    return (
      <div className={styles.frame}>
        <div ref={this.cover} className={styles.cover} />
        <div ref={this.live} className={styles.live}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
