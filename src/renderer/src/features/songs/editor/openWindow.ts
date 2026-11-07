import type {LlpApi} from '@contracts/ipc/api';
import type {
  OpenWindowResult,
  SongEditorTarget,
} from '@core/schema/ipcPayloads';
import {noticeTime, type Notice} from '@renderer/ui/notices';

type WindowApi = Pick<LlpApi, 'window'>;

function refusal(key: string, title: string): Notice {
  return {key, kind: 'warning', icon: 'warning', title, time: noticeTime()};
}

async function openWith(
  open: () => Promise<OpenWindowResult>,
  onProblem: (notice: Notice) => void,
  failure: Notice,
): Promise<void> {
  try {
    const result = await open();
    if (!result.ok) onProblem(failure);
  } catch (error) {
    console.error(failure.title, error);
    onProblem(failure);
  }
}

/**
 * Opens the 곡 편집 window, or moves it to the target. A refusal, such as a
 * window that doesn't exist yet, becomes a notice.
 */
export function openSongEditorWindow(
  api: WindowApi,
  target: SongEditorTarget,
  onProblem: (notice: Notice) => void,
): Promise<void> {
  return openWith(
    () => api.window.openSongEditor(target),
    onProblem,
    refusal('order-editor:open-song-editor', '곡 편집 창을 열 수 없음'),
  );
}
