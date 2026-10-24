import {act, fireEvent, screen} from '@testing-library/react';
import {installFakeClock, type FakeClock} from '../../../../test/fake-clock';
import {TOOLTIP_DELAY_MS, tooltipController} from './tooltipController';

/** Closes any tooltip that a test left showing. */
export function resetTooltips(): void {
  act(() => {
    tooltipController.hide();
  });
}

/** Moves a mouse pointer onto an element. */
export function pointAt(element: Element): void {
  fireEvent.pointerOver(element, {pointerType: 'mouse'});
}

/** Moves a mouse pointer off an element, out of the window. */
export function pointAway(element: Element): void {
  fireEvent.pointerOut(element, {pointerType: 'mouse'});
}

/** Lets fake time pass and renders what changed on the way. */
export async function letTimePass(
  clock: FakeClock,
  milliseconds: number,
): Promise<void> {
  await act(() => clock.advance(milliseconds));
}

/**
 * Rests the pointer on an element for the tooltip delay on a fake clock, and
 * returns the tooltip that shows. Run user-event steps before it, because
 * they wait on real timers.
 */
export async function hoverForTooltip(
  element: Element,
): Promise<HTMLElement | null> {
  const clock = installFakeClock();
  pointAt(element);
  await letTimePass(clock, TOOLTIP_DELAY_MS);
  return screen.queryByRole('tooltip');
}
