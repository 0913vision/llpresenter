import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {placeFloating} from '@renderer/ui/floating';
import {
  maxPopoverHeight,
  placeBelow,
  viewportSize,
} from '@renderer/ui/placement';

interface PopupOptions {
  readonly anchor: HTMLElement;
  readonly onClose: (restoreFocus: boolean) => void;
  readonly onEscape: () => void;
}

/** Initializes focus and releases every outside/viewport listener on close. */
export function useChoicePopup({anchor, onClose, onEscape}: PopupOptions): {
  readonly surface: RefObject<HTMLDivElement | null>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
} {
  const surface = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(onClose);
  useLayoutEffect(() => {
    const element = surface.current;
    if (element === null) return;
    element.style.maxHeight = `${maxPopoverHeight(viewportSize())}px`;
    placeFloating(element, size =>
      placeBelow(anchor.getBoundingClientRect(), size, viewportSize()),
    );
  });
  useLayoutEffect(() => {
    (
      surface.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      surface.current?.querySelector<HTMLElement>('[data-choice]')
    )?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const {signal} = controller;
    window.addEventListener('resize', () => close(false), {signal});
    document.addEventListener(
      'pointerdown',
      event => {
        const target = event.target;
        if (
          !(target instanceof Element) ||
          target.closest(
            '[data-llp-layer="popover"], [data-llp-layer="dialog"]',
          ) !== null ||
          anchor.contains(target)
        ) {
          return;
        }
        close(false);
      },
      {signal},
    );
    document.addEventListener(
      'scroll',
      event => {
        if (
          event.target instanceof Node &&
          !surface.current?.contains(event.target)
        ) {
          close(false);
        }
      },
      {signal, capture: true},
    );
    return () => controller.abort();
  }, [anchor]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isComposing(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }
    if (
      !(event.target instanceof HTMLElement) ||
      !event.target.matches('[data-choice]')
    ) {
      return;
    }
    const items = [
      ...(surface.current?.querySelectorAll<HTMLElement>('[data-choice]') ??
        []),
    ];
    const index = items.indexOf(event.target);
    const target =
      event.key === 'ArrowDown'
        ? (index + 1) % items.length
        : event.key === 'ArrowUp'
          ? (index - 1 + items.length) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : undefined;
    if (target !== undefined && !hasModifier(event)) {
      event.preventDefault();
      items[target]?.focus();
      return;
    }
    if (
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      const prefix = event.key.toLocaleLowerCase();
      for (let offset = 1; offset <= items.length; offset++) {
        const candidate = items[(index + offset) % items.length];
        if (
          candidate?.textContent.trim().toLocaleLowerCase().startsWith(prefix)
        ) {
          event.preventDefault();
          candidate.focus();
          return;
        }
      }
    }
  };
  return {surface, onKeyDown};
}
