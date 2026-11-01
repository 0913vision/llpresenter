import {vi} from 'vitest';
import type {MacroMenuHandlers} from './macroMenuEntries';

/** Handlers that record every call, for tests of the 매크로 menu. */
export function mockHandlers(): MacroMenuHandlers {
  const mockRun = vi.fn();
  return {
    rename: mockRun,
    changeIcon: mockRun,
    changeColor: mockRun,
    toggleStartup: mockRun,
    addTo: mockRun,
    moveTo: mockRun,
    newCollection: mockRun,
    addAction: mockRun,
    chooseAction: mockRun,
    openAction: mockRun,
    removeAllActions: mockRun,
    openPalette: mockRun,
    removeAction: mockRun,
    duplicate: mockRun,
    remove: mockRun,
  };
}
