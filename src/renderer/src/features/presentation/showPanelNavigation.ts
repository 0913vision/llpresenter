import {createContext, useRef, type KeyboardEvent, type RefObject} from 'react';
import {useCommandShortcuts} from '@renderer/ui/commandDispatcher';
import {isComposing} from '@renderer/ui/ime';
import {modalStack} from '@renderer/ui/modalStack';
import {tabbableElements} from '@renderer/ui/useModal';

const panels = [
  ['order', '예배 순서'],
  ['slides', '슬라이드'],
  ['quick', '퀵 실행'],
  ['preview', '미리보기'],
  ['clear', '지우기'],
  ['tools', '진행 도구'],
  ['media', '미디어'],
] as const;
const SLIDES = '[data-panel="슬라이드"]';
const GRID = '[role="listbox"][aria-label="슬라이드"]';
const SIZE = '[role="group"][aria-label="슬라이드 크기"]';

/** Lets the virtual grid reveal its logical entry before taking focus. */
export const ShowSlideEntry = createContext<RefObject<
  (() => void) | null
> | null>(null);

function available(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.closest('[hidden], [inert]')) {
    return false;
  }
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const css = getComputedStyle(node);
    if (css.display === 'none' || css.visibility === 'hidden') return false;
  }
  return true;
}

function panelOf(root: HTMLElement, title: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    title === '미디어'
      ? 'section[aria-label="미디어 보관함"], section[aria-label="접힌 미디어 보관함"]'
      : `[data-panel="${title}"]`,
  );
}

function slideRank(element: HTMLElement): number {
  return element.closest(GRID) ? 0 : element.closest(SIZE) ? 1 : 2;
}

function panelStops(panel: HTMLElement, title: string): HTMLElement[] {
  const stops = tabbableElements(panel).filter(available);
  return title === '슬라이드'
    ? stops.sort((a, b) => slideRank(a) - slideRank(b))
    : stops;
}

function orderedStops(root: HTMLElement): HTMLElement[] {
  return panels.flatMap(([, title]) => {
    const panel = panelOf(root, title);
    return panel ? panelStops(panel, title) : [];
  });
}

function entryStop(
  stops: readonly HTMLElement[],
  title: string,
): HTMLElement | undefined {
  const selector =
    title === '퀵 실행'
      ? '[data-quick-id]'
      : title === '미디어'
        ? '[aria-label="미디어 보기"] [role="listbox"]'
        : '[role="listbox"]';
  return stops.find(stop => stop.closest(selector)) ?? stops[0];
}

/** Tab follows panel reading order while the resizable columns keep their DOM. */
export function useShowPanelNavigation(
  root: RefObject<HTMLElement | null>,
  active: boolean,
) {
  const slideEntry = useRef<(() => void) | null>(null);
  const focus = (next: HTMLElement, from: Element | null): void => {
    if (next.closest(GRID) && !from?.closest(SLIDES) && slideEntry.current) {
      slideEntry.current();
    } else {
      next.focus();
    }
  };
  useCommandShortcuts(
    panels.map(([id, title]) => ({
      id: `panel.${id}`,
      when: () => active,
      run: () => {
        const panel = root.current && panelOf(root.current, title);
        if (!panel) return;
        const stops = panelStops(panel, title);
        const next = entryStop(stops, title);
        if (next) focus(next, null);
      },
    })),
  );
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const surface = root.current;
    if (
      !active ||
      !surface ||
      event.key !== 'Tab' ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      isComposing(event) ||
      modalStack.isOpen ||
      document.querySelector(
        '[role="menu"], [role="dialog"], [role="alertdialog"]',
      )
    ) {
      return;
    }
    const current = document.activeElement;
    if (!(current instanceof HTMLElement) || !surface.contains(current)) return;
    const stops = orderedStops(surface);
    const index = stops.indexOf(current);
    if (index < 0) return;
    const next = stops[index + (event.shiftKey ? -1 : 1)];
    if (next) {
      event.preventDefault();
      focus(next, current);
      return;
    }
    // NOTE(0913vision): Leave the workspace at either end, even when its last
    // visible panel is not the last column in DOM order.
    const all = tabbableElements(document.body).filter(available);
    const inside = all.filter(element => surface.contains(element));
    const boundary = event.shiftKey ? inside[0] : inside.at(-1);
    const outside =
      boundary && all[all.indexOf(boundary) + (event.shiftKey ? -1 : 1)];
    if (outside) {
      event.preventDefault();
      outside.focus();
    }
  };
  return {onKeyDown, slideEntry};
}
