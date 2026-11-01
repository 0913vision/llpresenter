import {renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {
  hideStageMessage,
  toggleActiveNotice,
} from '@renderer/features/tools/toolCommands';
import {useLiveStateShortcuts} from '@renderer/features/tools/useLiveStateShortcuts';

vi.mock('@renderer/platform/windowShortcuts', () => ({
  useWindowShortcuts: vi.fn(),
}));

describe('useLiveStateShortcuts', () => {
  it('runs the notice and stage message actions from their shortcuts', () => {
    renderHook(() => useLiveStateShortcuts());

    expect(useWindowShortcuts).toHaveBeenCalledWith([
      {id: 'notice.pauseResume', run: toggleActiveNotice},
      {id: 'stage.hideMessage', run: hideStageMessage},
    ]);
  });
});
