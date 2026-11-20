// NOTE(0913vision): The hooks below apply to each test file that imports this
// module.
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, vi} from 'vitest';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';
import type {Notice} from '@renderer/ui/notices';
import {libraryFixture} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {LibraryPanel} from '@renderer/features/songs/library/LibraryPanel';
import {applyService} from '@renderer/session/show';

export class FixedObserver implements ResizeObserver {
  static readonly instances: FixedObserver[] = [];
  readonly disconnect = vi.fn();
  constructor(private readonly callback: ResizeObserverCallback) {
    FixedObserver.instances.push(this);
  }
  observe(): void {
    this.callback([], this);
  }
  unobserve(): void {
    return;
  }
}

let previousRowSize = '';
let previousRowPriority = '';

beforeEach(() => {
  applyService(null);
  resetTooltips();
  FixedObserver.instances.length = 0;
  vi.stubGlobal('ResizeObserver', FixedObserver);
  const style = document.documentElement.style;
  previousRowSize = style.getPropertyValue('--size-row');
  previousRowPriority = style.getPropertyPriority('--size-row');
  style.setProperty('--size-row', '30px');
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
});

afterEach(() => {
  const style = document.documentElement.style;
  if (previousRowSize) {
    style.setProperty('--size-row', previousRowSize, previousRowPriority);
  } else {
    style.removeProperty('--size-row');
  }
  FixedObserver.instances.length = 0;
  resetTooltips();
  applyService(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export async function setup(fixture = libraryFixture()) {
  const onOpenSong = vi.fn();
  const onProblem = vi.fn<(notice: Notice) => void>();
  const result = render(
    <LibraryPanel
      api={fixture.api}
      onOpenSong={onOpenSong}
      onProblem={onProblem}
    />,
  );
  await screen.findAllByRole('option');
  return {...result, fixture, onOpenSong, onProblem, user: userEvent.setup()};
}
