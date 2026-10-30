import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {MediaPropertiesPanel} from './MediaPropertiesPanel';
import {MediaView} from './MediaView';
import {MediaViewProvider} from './MediaViewProvider';
import {AudioListsPanel, MediaListsPanel} from './MediaListPanels';
import {
  audioPlaylistId,
  playlistId,
  mediaDocument,
  mediaFixture,
  mediaId,
  mediaItem,
} from './mediaTesting';

const ITEMS = [
  mediaItem(1, {
    name: 'Dawn',
    duration: 30,
    width: 1920,
    height: 1080,
    size: 2048,
    file: 'dawn.mp4',
    props: {audio: false},
  }),
  mediaItem(2, {name: 'Notice', kind: 'image', file: 'notice.png'}),
  mediaItem(3, {name: 'Hymn', kind: 'audio', file: 'hymn.mp3'}),
];

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});

function setup(document: MediaDocument = mediaDocument(ITEMS, 5)) {
  const fixture = mediaFixture(document);
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  render(
    <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
      <MediaListsPanel />
      <AudioListsPanel />
      <MediaView onProblem={vi.fn()} />
      <MediaPropertiesPanel />
    </MediaViewProvider>,
  );
  return fixture;
}

async function choose(name: string): Promise<HTMLElement> {
  const grid = screen.getByRole('listbox', {name: '모든 미디어'});
  fireEvent.click(await within(grid).findByRole('option', {name}));
  return screen.getByRole('region', {name: '속성'});
}

function groups(panel: HTMLElement): ReadonlyArray<string | null> {
  return within(panel)
    .queryAllByRole('group')
    .map(group => group.querySelector('p')?.textContent ?? null);
}

describe('media properties panel', () => {
  it.each(['image', 'video'] as const)(
    'replaces a video and %s without retaining DOM across twenty round trips',
    async kind => {
      setup(
        mediaDocument([
          mediaItem(1, {name: 'Dawn', kind: 'video', file: 'dawn.mp4'}),
          mediaItem(2, {
            name: 'Notice',
            kind,
            file: kind === 'image' ? 'notice.png' : 'notice.mp4',
          }),
        ]),
      );
      const panel = await choose('Dawn');
      const videoCount = panel.querySelectorAll('*').length;
      await choose('Notice');
      const imageCount = panel.querySelectorAll('*').length;
      for (let round = 0; round < 20; round += 1) {
        await choose('Dawn');
        expect(panel.querySelectorAll('*')).toHaveLength(videoCount);
        expect(panel.querySelectorAll('video')).toHaveLength(1);
        expect(within(panel).getAllByRole('spinbutton')).toHaveLength(1);
        await choose('Notice');
        expect(panel.querySelectorAll('*')).toHaveLength(imageCount);
        expect(panel.querySelectorAll('video')).toHaveLength(
          kind === 'video' ? 1 : 0,
        );
        expect(within(panel).queryAllByRole('spinbutton')).toHaveLength(
          kind === 'video' ? 1 : 0,
        );
      }
    },
  );

  it.each(['media', 'audio'] as const)(
    'shows no stale properties after choosing an excluding %s playlist',
    async kind => {
      const {edit} = setup(
        mediaDocument(
          ITEMS,
          5,
          kind === 'media'
            ? {
                playlists: [
                  {id: playlistId(1), name: 'Other items', items: [mediaId(2)]},
                ],
              }
            : {
                audioPlaylists: [
                  {
                    id: audioPlaylistId(1),
                    name: 'Other items',
                    items: [mediaId(3)],
                    loop: false,
                  },
                ],
              },
        ),
      );
      const panel = await choose('Dawn');
      expect(
        within(panel).getByRole('spinbutton', {name: '속도'}),
      ).toBeDefined();
      const lists = screen.getByRole('listbox', {
        name: kind === 'media' ? '미디어 목록' : '오디오 재생목록',
      });
      fireEvent.click(within(lists).getByRole('option', {name: /Other items/}));
      const grid = await screen.findByRole('listbox', {name: 'Other items'});
      expect(within(panel).getByText('선택한 미디어 없음')).toBeDefined();
      expect(within(grid).queryByRole('option', {selected: true})).toBeNull();
      expect(edit).not.toHaveBeenCalled();
    },
  );

  it('constrains selection after a push removes it from the chosen playlist', async () => {
    const playlist = {
      id: playlistId(1),
      name: 'Selected list',
      items: [mediaId(1), mediaId(2)],
    };
    const {pushDocument, edit} = setup(
      mediaDocument(ITEMS, 5, {playlists: [playlist]}),
    );
    const panel = await choose('Dawn');
    fireEvent.click(
      within(screen.getByRole('listbox', {name: '미디어 목록'})).getByRole(
        'option',
        {name: /Selected list/},
      ),
    );
    const grid = await screen.findByRole('listbox', {name: 'Selected list'});
    expect(
      within(grid).getByRole('option', {name: 'Dawn', selected: true}),
    ).toBeDefined();
    act(() =>
      pushDocument(
        mediaDocument(ITEMS, 6, {
          playlists: [{...playlist, items: [mediaId(2)]}],
        }),
      ),
    );
    expect(within(panel).getByText('선택한 미디어 없음')).toBeDefined();
    expect(within(grid).queryByRole('option', {selected: true})).toBeNull();
    expect(edit).not.toHaveBeenCalled();
  });

  it.each(['enter', 'blur'])(
    'preserves a typed 1.10x speed on %s',
    async commit => {
      const {edit} = setup();
      const field = within(await choose('Dawn')).getByRole('spinbutton', {
        name: '속도',
      });
      fireEvent.change(field, {target: {value: '1.10×'}});
      if (commit === 'enter') fireEvent.keyDown(field, {key: 'Enter'});
      else fireEvent.blur(field);
      expect(edit).toHaveBeenCalledExactlyOnceWith({
        type: 'media.properties.update',
        mediaId: mediaId(1),
        changes: {props: {audio: false, speed: 1.1}},
        baseRevision: 5,
      });
    },
  );

  it.each([
    {key: 'ArrowUp', shiftKey: false, speed: 1.05},
    {key: 'ArrowDown', shiftKey: false, speed: 0.95},
    {key: 'ArrowUp', shiftKey: true, speed: 1.5},
    {key: 'ArrowDown', shiftKey: true, speed: 0.5},
  ])(
    'changes speed to $speed with $key and Shift $shiftKey',
    async ({key, shiftKey, speed}) => {
      const {edit} = setup();
      const field = within(await choose('Dawn')).getByRole('spinbutton', {
        name: '속도',
      });
      fireEvent.keyDown(field, {key, shiftKey});
      expect(edit).toHaveBeenCalledExactlyOnceWith({
        type: 'media.properties.update',
        mediaId: mediaId(1),
        changes: {props: {audio: false, speed}},
        baseRevision: 5,
      });
    },
  );
  it('says nothing is selected until a tile is', () => {
    setup();
    expect(
      within(screen.getByRole('region', {name: '속성'})).getByText(
        '선택한 미디어 없음',
      ),
    ).toBeDefined();
  });

  it('shows the groups that fit each kind', async () => {
    setup();
    expect(groups(await choose('Dawn'))).toEqual(['재생', '화면', '소리']);
    expect(groups(await choose('Notice'))).toEqual(['화면']);
    expect(groups(await choose('Hymn'))).toEqual(['재생', '소리']);
  });

  it('saves each change at once, keeping the other properties', async () => {
    const {edit} = setup();
    const panel = await choose('Dawn');
    fireEvent.click(within(panel).getByRole('radio', {name: '멈춤'}));
    expect(edit).toHaveBeenLastCalledWith({
      type: 'media.properties.update',
      mediaId: mediaId(1),
      changes: {props: {audio: false, end: 'stop'}},
      baseRevision: 5,
    });
    fireEvent.click(within(panel).getByRole('radio', {name: '맞추기'}));
    expect(edit).toHaveBeenLastCalledWith(
      expect.objectContaining({changes: {props: {audio: false, fit: 'fit'}}}),
    );
    fireEvent.click(within(panel).getByRole('switch'));
    expect(edit).toHaveBeenLastCalledWith(
      expect.objectContaining({changes: {props: {audio: true}}}),
    );
  });

  it('keeps a time draft on modified keys and IME composition', async () => {
    const {edit} = setup();
    const panel = await choose('Dawn');
    const start = within(panel).getByRole('textbox', {name: '시작'});
    fireEvent.change(start, {target: {value: '0:05.5'}});
    const keys = vi.fn();
    window.addEventListener('keydown', keys);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of ['Enter', 'Escape']) {
        expect(fireEvent.keyDown(start, {key, [modifier]: true})).toBe(true);
      }
    }
    window.removeEventListener('keydown', keys);
    expect(keys).toHaveBeenCalledTimes(8);
    fireEvent.keyDown(start, {key: 'Enter', isComposing: true});
    expect(start).toHaveProperty('value', '0:05.5');
    expect(edit).not.toHaveBeenCalled();
    fireEvent.keyDown(start, {key: 'Enter'});
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({changes: {props: {audio: false, in: 5.5}}}),
    );
  });

  it('takes a typed range only when it starts before it ends', async () => {
    const {edit} = setup();
    const panel = await choose('Dawn');
    const start = within(panel).getByRole('textbox', {name: '시작'});
    expect(start).toHaveProperty('value', '00:00.0');
    fireEvent.change(start, {target: {value: '0:40'}});
    fireEvent.keyDown(start, {key: 'Enter'});
    expect(edit).not.toHaveBeenCalled();
    fireEvent.change(start, {target: {value: '0:05.5'}});
    fireEvent.blur(start);
    expect(edit).toHaveBeenLastCalledWith(
      expect.objectContaining({changes: {props: {audio: false, in: 5.5}}}),
    );
    const end = within(panel).getByRole('textbox', {name: '끝'});
    fireEvent.change(end, {target: {value: '1:00'}});
    fireEvent.keyDown(end, {key: 'Enter'});
    expect(edit).toHaveBeenCalledOnce();
  });

  it('turns the volume off with the sound', async () => {
    setup();
    const panel = await choose('Dawn');
    expect(within(panel).getByRole('slider', {name: '음량'})).toHaveProperty(
      'disabled',
      true,
    );
    expect(
      within(await choose('Hymn')).getByRole('slider', {name: '음량'}),
    ).toHaveProperty('disabled', false);
  });

  it('shows the file in 정보', async () => {
    setup();
    const panel = await choose('Dawn');
    fireEvent.click(within(panel).getByRole('tab', {name: '정보'}));
    const text = panel.textContent;
    for (const value of ['영상', '1920×1080', '0:30', '2.0KB', 'dawn.mp4']) {
      expect(text).toContain(value);
    }
  });

  it('changes nothing in a list a newer version wrote', async () => {
    const {edit} = setup({...mediaDocument(ITEMS, 5), access: 'readOnly'});
    const panel = await choose('Dawn');
    fireEvent.click(within(panel).getByRole('radio', {name: '멈춤'}));
    expect(edit).not.toHaveBeenCalled();
  });

  it('previews the selected media and opens its file location', async () => {
    const fixture = setup();
    const reveal = vi.spyOn(fixture.api.media, 'reveal');
    const panel = await choose('Dawn');
    expect(panel.querySelector('video')).not.toBeNull();
    fireEvent.click(
      within(panel).getByRole('button', {name: '파일 위치 열기'}),
    );
    expect(reveal).toHaveBeenCalledExactlyOnceWith(mediaId(1));
  });
});
