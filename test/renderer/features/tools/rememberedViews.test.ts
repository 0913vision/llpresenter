import {afterEach, expect, it, vi} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {seedPreview, showLarge, usePreview} from '@renderer/session/preview';
import {
  seedShowToolTab,
  useShowToolTab,
} from '@renderer/features/tools/showToolTab';

afterEach(() => {
  delete window.llp;
});

it('restores and saves the large preview and last tool', () => {
  const screen = createScreenId('00000000-0000-4000-8000-000000000001');
  const save = vi.fn();
  window.llp = mockLlpApi({ui: {setRememberedView: save}});
  seedPreview({previewBig: screen});
  seedShowToolTab({showToolTab: 'timer'});
  expect(usePreview.getState().largeScreenId).toBe(screen);
  expect(useShowToolTab.getState().tool).toBe('timer');
  showLarge(screen);
  useShowToolTab.getState().setTool('macro');
  expect(save).toHaveBeenCalledWith({previewBig: screen});
  expect(save).toHaveBeenCalledWith({showToolTab: 'macro'});
});
