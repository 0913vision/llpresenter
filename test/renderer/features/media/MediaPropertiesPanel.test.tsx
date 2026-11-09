import {fireEvent, render, screen, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {MediaPropertiesPanel} from '@renderer/features/media/MediaPropertiesPanel';
import {MediaView} from '@renderer/features/media/MediaView';
import {MediaViewProvider} from '@renderer/features/media/MediaViewProvider';
import {
  AudioListsPanel,
  MediaListsPanel,
} from '@renderer/features/media/MediaListPanels';
import {
  mediaDocument,
  mediaFixture,
  mediaId,
  mediaItem,
} from '@fixtures/renderer/features/media/mediaTesting';

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
  return screen.getByRole('region', {name: '미디어 속성'});
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
      expect(
        within(panel)
          .getByRole('tab', {name: '미디어 속성'})
          .getAttribute('aria-selected'),
      ).toBe('true');
      const videoCount = panel.querySelectorAll('*').length;
      await choose('Notice');
      const imageCount = panel.querySelectorAll('*').length;
      for (let round = 0; round < 20; round += 1) {
        await choose('Dawn');
        expect(panel.querySelectorAll('*')).toHaveLength(videoCount);
        expect(panel.querySelector('video')).toBeNull();
        expect(within(panel).getAllByRole('spinbutton')).toHaveLength(1);
        await choose('Notice');
        expect(panel.querySelectorAll('*')).toHaveLength(imageCount);
        expect(panel.querySelector('video')).toBeNull();
        expect(within(panel).queryAllByRole('spinbutton')).toHaveLength(
          kind === 'video' ? 1 : 0,
        );
      }
    },
  );

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

  it('says nothing is selected until a tile is', () => {
    setup();
    expect(
      within(screen.getByRole('region', {name: '미디어 속성'})).getByText(
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
    fireEvent.click(within(panel).getByRole('radio', {name: '정지'}));
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
    fireEvent.click(within(panel).getByRole('checkbox'));
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
    fireEvent.click(within(panel).getByRole('radio', {name: '정지'}));
    expect(edit).not.toHaveBeenCalled();
  });

  it('previews the selected media and opens its file location', async () => {
    const fixture = setup();
    const reveal = vi.spyOn(fixture.api.media, 'reveal');
    const panel = await choose('Dawn');
    expect(panel.querySelector('video')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', {name: '재생'}));
    expect(panel.querySelector('video')).not.toBeNull();
    fireEvent.click(
      within(panel).getByRole('button', {name: '파일 위치 열기'}),
    );
    expect(reveal).toHaveBeenCalledExactlyOnceWith(mediaId(1));
  });
});

it('explains theme fit precedence in a tooltip while keeping media fit editable', async () => {
  setup();
  const panel = await choose('Notice');
  const group = within(panel).getByRole('radiogroup', {name: '\ub9de\ucda4'});
  const target = within(panel).getByTestId('media-fit-tooltip');
  fireEvent.pointerEnter(target);
  expect((await screen.findByRole('tooltip')).textContent).toContain(
    '\ud14c\ub9c8\uc758 \ub9de\ucda4\uc774 \uc6b0\uc120\ud569\ub2c8\ub2e4',
  );
  expect(
    within(group).getByRole('radio', {name: '\ucc44\uc6b0\uae30'}),
  ).toHaveProperty('disabled', false);
});

it('shows the fit precedence tooltip on keyboard focus', async () => {
  setup();
  const panel = await choose('Notice');
  const target = within(panel).getByTestId('media-fit-tooltip');
  const match = vi.spyOn(target, 'matches').mockReturnValue(true);
  const control = within(panel).getByRole('radio', {
    name: '\ucc44\uc6b0\uae30',
  });
  fireEvent.focus(control);
  expect((await screen.findByRole('tooltip')).textContent).toContain(
    '\ud14c\ub9c8\uc758 \ub9de\ucda4\uc774 \uc6b0\uc120\ud569\ub2c8\ub2e4',
  );
  match.mockRestore();
});
