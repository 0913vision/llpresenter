import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {useLive} from '@renderer/state/live';
import {NoticePlayback} from './NoticePlayback';
import {stageFixture} from './stageTesting';

const parsed = parseSettingsDocument({
  name: 'notices',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llsettings.notices',
    schemaVersion: 1,
    sets: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: '공지',
        media: [
          '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000003',
        ],
        interval: 8,
        loop: true,
        targets: ['00000000-0000-4000-8000-000000000004'],
      },
    ],
  },
});
if (!parsed.ok || parsed.value.name !== 'notices') {
  throw new Error('Invalid fixture');
}
const item = parsed.value.value.sets[0];
if (!item) throw new Error('Missing fixture');
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.useRealTimers();
});

it('starts a selected image and lets arrows move focus without output', () => {
  const f = stageFixture();
  render(<NoticePlayback item={item} media={[]} />);
  const first = screen.getByRole('option', {name: '이미지 1'});
  const second = screen.getByRole('option', {name: '이미지 2'});
  first.focus();
  fireEvent.keyDown(first, {key: 'ArrowRight'});
  expect(document.activeElement).toBe(second);
  expect(f.send).not.toHaveBeenCalled();
  fireEvent.keyDown(second, {key: 'Enter'});
  fireEvent.keyUp(second, {key: 'Enter'});
  expect(f.send).toHaveBeenCalledWith({
    type: 'notice.start',
    noticeId: item.id,
    position: 1,
  });
});

it('marks the advancing image and pauses or resumes through live commands', () => {
  vi.useFakeTimers();
  const f = stageFixture();
  const state = useLive.getState().state;
  if (!state) throw new Error('Missing live state');
  const playback = {
    media: item.media,
    position: 0,
    interval: 8,
    loop: true,
    targets: item.targets,
    startedAt: Date.now(),
    pausedAt: null,
  };
  useLive.setState({
    state: {
      ...state,
      layers: {...state.layers, notice: {noticeId: item.id, playback}},
    },
  });
  const view = render(<NoticePlayback item={item} media={[]} />);
  expect(
    screen.getByRole('option', {name: '이미지 1'}).getAttribute('data-state'),
  ).toBe('live');
  act(() => {
    vi.advanceTimersByTime(8000);
  });
  expect(
    screen.getByRole('option', {name: '이미지 2'}).getAttribute('data-state'),
  ).toBe('live');
  fireEvent.click(screen.getByRole('button', {name: '일시 정지'}));
  expect(f.send).toHaveBeenLastCalledWith({type: 'notice.pause'});
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          notice: {
            noticeId: item.id,
            playback: {...playback, pausedAt: Date.now()},
          },
        },
      },
    }),
  );
  fireEvent.click(screen.getByRole('button', {name: '재생'}));
  expect(f.send).toHaveBeenLastCalledWith({
    type: 'notice.start',
    noticeId: item.id,
  });
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
