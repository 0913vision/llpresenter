import {isLayerContainer} from './layers';

const INERT = 'inert';
const DIALOG_LAYER = '[data-llp-layer="dialog"]';

/**
 * The open modal surfaces, topmost last. Everything outside the topmost one
 * is inert, except the popover, tooltip, and notification layers (so menus
 * opened inside a dialog work and notifications stay clickable).
 */
export class ModalStack {
  private readonly open: HTMLElement[] = [];
  private readonly madeInert = new Set<Element>();

  /** Opens a modal and returns the function that closes it. */
  push(modal: HTMLElement): () => void {
    this.open.push(modal);
    this.apply();
    return () => {
      const index = this.open.lastIndexOf(modal);
      if (index >= 0) this.open.splice(index, 1);
      this.apply();
    };
  }

  /** Whether any modal is open. */
  get isOpen(): boolean {
    return this.open.length > 0;
  }

  /** Whether this modal is the topmost one, the one that takes the keys. */
  isTop(modal: HTMLElement): boolean {
    return this.open.at(-1) === modal;
  }

  private apply(): void {
    for (const element of this.madeInert) element.removeAttribute(INERT);
    this.madeInert.clear();
    const top = this.open.at(-1);
    if (top === undefined) return;
    for (const child of document.body.children) {
      if (child.contains(top) || this.staysLive(child)) continue;
      this.makeInert(child);
    }
    for (const below of this.open.slice(0, -1)) this.makeInert(below);
  }

  private staysLive(element: Element): boolean {
    return isLayerContainer(element) && !element.matches(DIALOG_LAYER);
  }

  private makeInert(element: Element): void {
    if (element.hasAttribute(INERT)) return;
    element.setAttribute(INERT, '');
    this.madeInert.add(element);
  }
}

/** The modal stack of the window. */
export const modalStack = new ModalStack();
