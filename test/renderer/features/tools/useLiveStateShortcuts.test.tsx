import {renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {hideStageMessage} from '@renderer/features/tools/toolCommands';
import {useLiveStateShortcuts} from '@renderer/features/tools/useLiveStateShortcuts';

vi.mock('@renderer/platform/windowShortcuts', () => ({
  useWindowShortcuts: vi.fn(),
}));

describe('useLiveStateShortcuts', () => {
  it('runs the stage message action from their shortcuts', () => {
    renderHook(() => useLiveStateShortcuts());

    expect(useWindowShortcuts).toHaveBeenCalledWith([
      {id: 'stage.hideMessage', run: hideStageMessage},
    ]);
  });
});
