import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import {MediaPropertiesPanel} from './MediaPropertiesPanel';
import {MediaView} from './MediaView';
import {MediaViewProvider} from './MediaViewProvider';
import {mediaDocument, mediaFixture, mediaId, mediaItem} from './mediaTesting';

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

function setup(document: MediaDocument = mediaDocument(ITEMS, 5)) {
  const fixture = mediaFixture(document);
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  render(
    <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
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
});
