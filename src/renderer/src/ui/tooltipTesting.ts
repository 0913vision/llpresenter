import {act, screen} from '@testing-library/react';
import userEvent, {type UserEvent} from '@testing-library/user-event';
import {vi} from 'vitest';
import {TOOLTIP_DELAY_MS, tooltipController} from './tooltipController';

/** Starts fake timers and a user that advances them, for tooltip tests. */
export function setupTooltipUser(): UserEvent {
  // NOTE(0913vision): Testing Library waits on a real-time setTimeout after
  // each event, so the fake clock must also follow real time.
  vi.useFakeTimers({shouldAdvanceTime: true});
  return userEvent.setup({advanceTimers: vi.advanceTimersByTime});
}

/** Closes any tooltip and goes back to real timers after a tooltip test. */
export function resetTooltips(): void {
  act(() => tooltipController.hide());
  vi.useRealTimers();
}

/** Rests the pointer on an element and returns the tooltip that shows. */
export async function hoverForTooltip(
  user: UserEvent,
  element: Element,
): Promise<HTMLElement | null> {
  await user.hover(element);
  act(() => {
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  });
  return screen.queryByRole('tooltip');
}
