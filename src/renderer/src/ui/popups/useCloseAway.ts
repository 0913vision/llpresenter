import {useEffect, useEffectEvent, type RefObject} from 'react';

/**
 * Closes a popup that is not modal when the pointer goes down outside it or
 * Escape is pressed. `keeps` names the other places a press may land without
 * closing it, such as the button that opened it or a layer above it.
 */
export function useCloseAway(
  surface: RefObject<HTMLElement | null>,
  onClose: () => void,
  keeps: (target: Element) => boolean = () => false,
): void {
  const close = useEffectEvent(onClose);
  const kept = useEffectEvent(keeps);
  useEffect(() => {
    const away = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (surface.current?.contains(target) === true || kept(target)) return;
      close();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape);
    };
  }, [surface]);
}
