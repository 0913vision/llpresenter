import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {SlideInspector} from '@renderer/features/service/slideInspector/SlideInspector';
import {describe, expect, it, vi} from 'vitest';
import {editorSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditor} from '@renderer/features/songs/editor/SongEditor';
import {pictures} from '@renderer/rendering/pictures/pictureService';
import {seedSlideSurfaceView} from '@renderer/features/songs/editor/SlideSurfaceView';
import {
  editorSetup,
  lyrics,
} from '@fixtures/renderer/features/songs/editor/editorTesting';

vi.mock(
  '@renderer/rendering/pictures/Picture',
  () => import('@fixtures/renderer/picture'),
);

function cursor(input: HTMLTextAreaElement, start: number, end = start): void {
  act(() => {
    input.focus();
    input.setSelectionRange(start, end);
    fireEvent.select(input);
  });
}

describe('song editor view', () => {
  it('shows theme fields by source slide in rows and leaves grid tiles selectable', async () => {
    seedSlideSurfaceView({});
    const {store, session, view, user} = await editorSetup();
    const ids = session.history.snapshot.song.slides.map(slide => slide.id);
    view.rerender(
      <SongEditor
        store={store}
        renderTextFields={slide => (
          <textarea aria-label="테마 요소" defaultValue={String(slide)} />
        )}
      />,
    );
    const surface = within(
      screen.getByRole('group', {name: '슬라이드 편집 명령'}),
    );
    expect(
      surface
        .getAllByRole<HTMLTextAreaElement>('textbox')
        .map(field => field.value),
    ).toEqual(ids);
    await user.click(screen.getByRole('button', {name: '격자'}));
    expect(surface.queryByRole('textbox')).toBeNull();
    const second = view.container.querySelector('[data-editor-block="1"]');
    if (!second) throw Error('Missing second slide');
    await user.click(second);
    expect(session.selectedOccurrence).toBe(1);
    seedSlideSurfaceView({});
  });

  it('places the next song row after the measured height of all theme fields', async () => {
    seedSlideSurfaceView({});
    const {store, view} = await editorSetup();
    const height = 280;
    const original = HTMLElement.prototype.getBoundingClientRect;
    const bounds = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-editor-block') &&
          this.querySelector('fieldset') !== null
          ? new DOMRect(0, 0, 700, height)
          : original.call(this);
      });
    try {
      view.rerender(
        <SongEditor
          store={store}
          renderTextFields={() => (
            <fieldset aria-label="Theme text">
              <textarea aria-label="Body" />
              <textarea aria-label="Clock" />
            </fieldset>
          )}
        />,
      );
      const second = view.container.querySelector<HTMLElement>(
        '[data-editor-block="1"]',
      );
      expect(second?.style.top).toBe(`${height}px`);
    } finally {
      bounds.mockRestore();
    }
  });

  it.each(['Escape', 'choose'] as const)(
    'returns slide shortcuts after the label picker closes with %s',
    async close => {
      const {session, user} = await editorSetup();
      const row = document.querySelector<HTMLElement>('[data-editor-block]');
      if (row === null) throw new Error('Missing slide');
      await user.click(row);
      const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
      const count = session.history.snapshot.song.slides.length;
      const selectedIds = [...session.slideModel.getSnapshot().selection.ids];
      expect(selectedIds).toHaveLength(1);
      await user.keyboard('{Control>}g{/Control}');
      expect(screen.getByRole('menu', {name: '이름표'})).toBeDefined();
      if (close === 'Escape') await user.keyboard('{Escape}');
      else await user.click(screen.getByRole('menuitemradio', {name: '후렴'}));
      expect(document.activeElement).toBe(surface);
      expect([...session.slideModel.getSnapshot().selection.ids]).toEqual(
        selectedIds,
      );
      await user.keyboard('{Control>}g{/Control}');
      expect(screen.getByRole('menu', {name: '이름표'})).toBeDefined();
      await user.keyboard('{Escape}');
      expect(document.activeElement).toBe(surface);
      await user.keyboard('{ArrowDown}{Delete}');
      expect(session.history.snapshot.song.slides).toHaveLength(count - 1);
      await user.keyboard('{Control>}z{/Control}');
      expect(session.history.snapshot.song.slides).toHaveLength(count);
    },
  );
  it('places the view switch and grid size control in the slide footer', async () => {
    seedSlideSurfaceView({});
    const {user} = await editorSetup();
    const toolbar = screen.getByRole('toolbar', {
      name: '슬라이드 보기',
    });
    const footer = toolbar.closest('footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('2개');
    expect(within(toolbar).queryByRole('spinbutton')).toBeNull();
    await user.click(within(toolbar).getByRole('button', {name: '격자'}));
    expect(within(toolbar).getByRole('spinbutton')).toBeDefined();
    seedSlideSurfaceView({});
  });

  it('preserves a native text selection across an unrelated render', async () => {
    const {store, view} = await editorSetup();
    const input = lyrics();
    input.focus();
    input.setSelectionRange(0, input.value.length);
    view.rerender(<SongEditor store={store} addCard={<span>Card</span>} />);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });
  it.each(['list', 'grid'] as const)(
    'keeps both add controls after the slides in %s',
    async mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
      const {store, view} = await editorSetup();
      view.rerender(
        <SongEditor
          store={store}
          addCard={<button type="button">타이틀</button>}
        />,
      );
      const slides = view.container.querySelector('[data-editor-block]');
      if (slides === null) throw Error('Missing slide');
      const add = screen.getByRole('button', {name: '슬라이드 추가'});
      const card = screen.getByRole('button', {name: '타이틀'});
      expect(add.closest('footer')).not.toBeNull();
      expect(add.closest('[data-slide-columns]')).toBeNull();
      expect(
        slides.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(add.parentElement).toBe(card.parentElement);
      seedSlideSurfaceView({});
    },
  );
  it.each(['list', 'grid'] as const)(
    'marks only the menu selection in the %s editor',
    async mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
      const {session, view} = await editorSetup();
      act(() => {
        for (let index = 0; index < 4; index++) session.edit({type: 'insert'});
      });
      const rows = [
        ...view.container.querySelectorAll<HTMLElement>('[data-song-slide]'),
      ];
      expect(rows).toHaveLength(6);
      const surface = rows[2]?.closest('[role="group"]');
      if (!rows[1] || !rows[2] || !surface) throw Error('Missing slides');
      fireEvent.contextMenu(rows[2]);
      expect(rows.filter(row => row.hasAttribute('data-menu-target'))).toEqual([
        rows[2],
      ]);
      expect(surface.hasAttribute('data-menu-target')).toBe(false);
      fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
      fireEvent.click(rows[1]);
      fireEvent.click(rows[2], {ctrlKey: true});
      fireEvent.contextMenu(rows[2]);
      expect(rows.filter(row => row.hasAttribute('data-menu-target'))).toEqual([
        rows[1],
        rows[2],
      ]);
      expect(surface.hasAttribute('data-menu-target')).toBe(false);
      seedSlideSurfaceView({});
    },
  );
  it('adds after the clicked slide or at the end from empty space', async () => {
    const {session, user, view} = await editorSetup();
    const original = session.history.snapshot.song.slides.map(
      slide => slide.id,
    );
    const row = view.container.querySelector('[data-editor-block="0"]');
    if (row === null) throw Error('Missing slide');
    fireEvent.contextMenu(row);
    await user.click(screen.getByRole('menuitem', {name: '슬라이드 추가'}));
    expect(session.history.snapshot.song.slides[2]?.id).toBe(original[1]);
    fireEvent.contextMenu(
      screen.getByRole('group', {name: '슬라이드 편집 명령'}),
    );
    await user.click(screen.getByRole('menuitem', {name: '슬라이드 추가'}));
    expect(session.history.snapshot.song.slides).toHaveLength(4);
    expect(session.history.snapshot.song.slides[2]?.id).toBe(original[1]);
  });
  it.each(['list', 'grid'] as const)(
    'shows an independent leading card before song slides in %s',
    async mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
      const {store, session, user, view} = await editorSetup();
      const onDelete = vi.fn();
      const onSelectChange = vi.fn();
      const count = session.history.snapshot.song.slides.length;
      view.rerender(
        <SongEditor
          store={store}
          leadingCard={{
            label: '구역 이름',
            render: current => <span>{`Card ${current}`}</span>,
            onDelete,
            onSelectChange,
          }}
        />,
      );
      const card = screen.getByLabelText('구역 이름');
      expect(card.textContent).toBe(`Card ${mode}`);
      expect(
        screen.getByRole('textbox', {
          name: '슬라이드 2 가사',
        }),
      ).toBeDefined();
      await user.click(card);
      await user.keyboard('{Delete}');
      expect(onDelete).toHaveBeenCalledOnce();
      expect(session.history.snapshot.song.slides).toHaveLength(count);
      expect(onSelectChange).toHaveBeenCalledWith(true);
      seedSlideSurfaceView({});
    },
  );

  it('selects a leading card together with a song slide and clears the slide on a plain card click', async () => {
    const {store, session, user, view} = await editorSetup();
    const onSelectChange = vi.fn();
    view.rerender(
      <SongEditor
        store={store}
        leadingCard={{
          label: 'Section',
          mixedSelection: true,
          render: () => <span>Section</span>,
          onDelete: vi.fn(),
          onSelectChange,
        }}
      />,
    );
    const card = screen.getByLabelText('Section');
    const row = view.container.querySelector<HTMLElement>('[data-song-slide]');
    if (row === null) throw Error('Missing song slide');
    await user.click(card);
    expect(session.slideModel.getSnapshot().selection.ids.size).toBe(0);
    await user.keyboard('[ControlLeft>]');
    await user.click(row);
    await user.keyboard('[/ControlLeft]');
    expect(onSelectChange).toHaveBeenLastCalledWith(true);
    expect(session.slideModel.getSnapshot().selection.ids.size).toBe(1);
    await user.click(card);
    expect(session.slideModel.getSnapshot().selection.ids.size).toBe(0);
  });

  it('renders a custom card with editable fields in both views', async () => {
    const {store, session, user, view} = await editorSetup();
    const renderCard = (_slide: unknown, index: number, mode: string) =>
      index === 0 ? (
        <input aria-label="Section card" data-mode={mode} defaultValue={mode} />
      ) : undefined;
    view.rerender(<SongEditor store={store} renderCard={renderCard} />);
    expect(screen.getByRole('textbox', {name: 'Section card'})).toHaveProperty(
      'value',
      'list',
    );
    const first = view.container.querySelector<HTMLElement>(
      '[data-editor-block="0"]',
    );
    if (first === null) throw new Error('Missing card row');
    fireEvent.click(first);
    const firstSlide = session.history.snapshot.song.slides[0];
    if (firstSlide === undefined) throw new Error('Missing slide');
    expect(
      session.slideModel.getSnapshot().selection.ids.has(firstSlide.id),
    ).toBe(true);
    await user.click(screen.getByRole('button', {name: '격자'}));
    const card = screen.getByRole('textbox', {name: 'Section card'});
    expect(card.getAttribute('data-mode')).toBe('grid');
    fireEvent.change(card, {target: {value: 'Edited card'}});
    expect(card).toHaveProperty('value', 'Edited card');
    expect(
      view.container
        .querySelector('[data-editor-block="0"]')
        ?.getAttribute('data-grid'),
    ).toBe('true');
    await user.click(screen.getByRole('button', {name: '목록'}));
  });

  it('edits slide text in both surface views', async () => {
    const {session, user} = await editorSetup();
    const toolbar = screen.getByRole('toolbar', {
      name: '슬라이드 보기',
    });
    fireEvent.change(lyrics(), {target: {value: 'List edit'}});
    await user.click(within(toolbar).getByRole('button', {name: '격자'}));
    expect(lyrics().value).toBe('List edit');
    fireEvent.change(lyrics(), {target: {value: 'Grid edit'}});
    await user.click(within(toolbar).getByRole('button', {name: '목록'}));
    expect(lyrics().value).toBe('Grid edit');
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'Grid edit',
    ]);
  });

  it('deletes selected slides immediately without a notice', async () => {
    const {session, onProblem, user} = await editorSetup();
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    act(() => session.selectSlides({type: 'all'}));
    act(() => session.commandSlides({type: 'duplicate'}));
    fireEvent.contextMenu(surface);
    await user.click(screen.getByRole('menuitem', {name: /2개 삭제/}));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(session.history.snapshot.song.slides).toHaveLength(2);
    expect(onProblem).not.toHaveBeenCalled();
  });
  it('tabs from slide commands to label and lyrics, skipping pointer insertion gutters in both directions', async () => {
    const {session, user} = await editorSetup();
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    act(() => surface.focus());
    await user.tab();
    const label = document.activeElement;
    expect(
      label?.closest('[data-editor-block]')?.getAttribute('data-editor-block'),
    ).toBe('0');
    expect(label?.hasAttribute('data-slide-gap')).toBe(false);
    expect(label?.tagName).toBe('BUTTON');
    await user.tab();
    expect(document.activeElement).toBe(lyrics());
    await user.tab({shift: true});
    expect(document.activeElement).toBe(label);
    await user.tab({shift: true});
    expect(document.activeElement).toBe(surface);
    await user.keyboard('{Escape}{Home}');
    expect(session.slideModel.getSnapshot().selection.caret).toBe(0);
    await user.keyboard('{End}');
    expect(session.slideModel.getSnapshot().selection.caret).toBe(
      session.slideModel.getSnapshot().slides.length,
    );
    const end = screen.getByRole('button', {name: '마지막 슬라이드 뒤에 삽입'});
    expect(end.tabIndex).toBe(-1);
    await user.click(
      screen.getByRole('button', {name: '슬라이드 1 앞에 삽입'}),
    );
    expect(session.slideModel.getSnapshot().selection.caret).toBe(0);
    expect(document.activeElement).toBe(surface);
  });

  it('toggles with the list checkbox and Space while preserving pointer selection modifiers', async () => {
    const {session, user} = await editorSetup();
    const rows = [
      ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
    ];
    const first = rows[0];
    const second = rows[1];
    if (!first || !second) throw new Error('Missing rows');
    const count = () => session.slideModel.getSnapshot().selection.ids.size;
    await user.click(first);
    const box = screen.getByRole('checkbox', {name: '슬라이드 2 선택'});
    await user.click(box);
    expect(count()).toBe(2);
    expect(box.getAttribute('aria-checked')).toBe('true');
    await user.keyboard(' ');
    expect(count()).toBe(1);
    expect(document.activeElement).toBe(box);
    await user.keyboard(' ');
    expect(count()).toBe(2);
    await user.click(second);
    expect(count()).toBe(1);
    await user.keyboard(' ');
    expect(count()).toBe(0);
    await user.keyboard(' ');
    expect(count()).toBe(1);
    fireEvent.click(first, {shiftKey: true});
    expect(count()).toBe(2);
    fireEvent.click(second, {ctrlKey: true});
    expect(count()).toBe(1);
    await user.click(second);
    expect(count()).toBe(1);
    const input = lyrics(2);
    await user.click(input);
    const length = input.value.length;
    await user.keyboard(' ');
    expect(count()).toBe(1);
    expect(input.value.length).toBe(length + 1);
  });

  it('selects rows from the area beside the lyric field and keeps field clicks for editing', async () => {
    const {session} = await editorSetup();
    const rows = [
      ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
    ];
    const first = rows[0]?.querySelector<HTMLElement>('[data-grid-text]');
    const second = rows[1]?.querySelector<HTMLElement>('[data-grid-text]');
    if (!first || !second) throw Error('Missing text areas');
    fireEvent.click(first);
    fireEvent.click(second, {ctrlKey: true});
    expect(session.slideModel.getSnapshot().selection.ids.size).toBe(2);
    fireEvent.click(first);
    fireEvent.click(second, {shiftKey: true});
    expect(session.slideModel.getSnapshot().selection.ids.size).toBe(2);
    fireEvent.click(first);
    const field = second.querySelector('textarea');
    if (!field) throw Error('Missing lyric field');
    fireEvent.click(field, {ctrlKey: true});
    expect(session.slideModel.getSnapshot().selection.ids.size).toBe(1);
  });

  it('adds, edits, undoes and deletes a title while keeping repeat insertion available', async () => {
    const {session, user} = await editorSetup();
    const before = session.history.snapshot.song.slides;
    await user.click(
      screen.getByRole('button', {name: '슬라이드 1 앞에 삽입'}),
    );
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    fireEvent.contextMenu(surface);
    await user.click(
      screen.getByRole('menuitem', {name: '제목 슬라이드 추가'}),
    );
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      titleSlide: true,
      lines: [session.title.nextValue],
    });
    const input = screen.getByRole('textbox', {
      name: '슬라이드 1 제목 및 부제',
    });
    fireEvent.change(input, {target: {value: 'New title\nSubtitle'}});
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'New title',
      'Subtitle',
    ]);
    fireEvent.contextMenu(surface);
    expect(
      screen
        .getByRole('menuitem', {name: '제목 슬라이드 추가'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
    await user.keyboard('{Escape}');
    act(() => session.edit('undo'));
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      session.title.nextValue,
    ]);
    act(() => session.edit('undo'));
    expect(session.history.snapshot.song.slides).toEqual(before);
    act(() => session.edit('redo'));
    expect(session.history.snapshot.song.slides).toHaveLength(
      before.length + 1,
    );
    act(() => session.commandSlides({type: 'delete'}));
    expect(session.history.snapshot.song.slides).toEqual(before);
  });
  it.each(['number', 'thumbnail', 'margin'])(
    'keeps slide shortcuts active after clicking the row %s from a text field',
    async place => {
      const {session, user} = await editorSetup();
      const row = document.querySelector<HTMLElement>('[data-editor-block]');
      if (row === null) throw new Error('Missing row');
      await user.click(lyrics(2));
      const target =
        place === 'number'
          ? row.querySelector(':scope > span')
          : place === 'thumbnail'
            ? row.querySelector('[data-editor-thumbnail]')
            : row;
      if (!(target instanceof HTMLElement)) throw new Error('Missing target');
      await user.click(target);
      expect(document.activeElement).toBe(
        screen.getByRole('group', {name: '슬라이드 편집 명령'}),
      );
      const original = session.history.snapshot.song.slides;
      await user.keyboard('{Control>}c{/Control}');
      expect(await navigator.clipboard.readText()).toBe(
        original[0]?.lines.join('\n'),
      );
      await user.keyboard('{Control>}d{/Control}');
      expect(session.history.snapshot.song.slides).toHaveLength(
        original.length + 1,
      );
      await user.keyboard('{Delete}');
      expect(session.history.snapshot.song.slides).toEqual(original);
    },
  );

  it('queues repeated paste behind an unfinished copy, with independent ids and one undo per paste', async () => {
    const {session, user} = await editorSetup();
    const original = session.history.snapshot.song.slides;
    const row = document.querySelector<HTMLElement>('[data-editor-block]');
    if (row === null) throw new Error('Missing row');
    fireEvent.click(row);
    let finish: (() => void) | undefined;
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const read = vi
      .spyOn(navigator.clipboard, 'readText')
      .mockResolvedValue(original[0]?.lines.join('\n') ?? '');
    await user.keyboard('{Control>}c{/Control}');
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    act(() => {
      fireEvent.keyDown(surface, {key: 'v', code: 'KeyV', ctrlKey: true});
      fireEvent.keyDown(surface, {key: 'v', code: 'KeyV', ctrlKey: true});
    });
    expect(read).not.toHaveBeenCalled();
    await act(async () => {
      finish?.();
    });
    await waitFor(() =>
      expect(session.history.snapshot.song.slides).toHaveLength(
        original.length + 2,
      ),
    );
    const ids = session.history.snapshot.song.slides.map(slide => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(
      original.length + 1,
    );
    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toEqual(original);
  });

  it('cancels a pending system paste when the operator selects another slide', async () => {
    const {session} = await editorSetup();
    const rows = [
      ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
    ];
    if (!rows[0] || !rows[1]) throw new Error('Missing rows');
    fireEvent.click(rows[0]);
    const original = session.history.snapshot.song.slides;
    let finish: ((text: string) => void) | undefined;
    vi.spyOn(navigator.clipboard, 'readText').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.keyDown(screen.getByRole('group', {name: '슬라이드 편집 명령'}), {
      key: 'v',
      code: 'KeyV',
      ctrlKey: true,
    });
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.click(rows[1]);
    await act(async () => {
      finish?.('External slide');
    });
    expect(session.history.snapshot.song.slides).toEqual(original);
    expect(session.selectedOccurrence).toBe(1);
  });
  it('selects rows with Shift and Ctrl, then shares duplicate, undo, and gap paste commands', async () => {
    const {session, user} = await editorSetup();
    const rows = (): HTMLElement[] => [
      ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
    ];
    const first = rows()[0];
    const second = rows()[1];
    if (!first || !second) throw new Error('Missing rows');
    fireEvent.click(first);
    fireEvent.click(second, {shiftKey: true});
    expect(session.history.model.getSnapshot().selection.ids.size).toBe(2);
    expect(rows().filter(row => row.dataset.active === 'true')).toHaveLength(2);
    expect(rows().filter(row => row.dataset.focused === 'true')).toEqual([
      second,
    ]);
    const original = session.history.snapshot.song.slides;
    await user.keyboard('{Control>}d{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(
      original.length + 2,
    );
    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toEqual(original);
    fireEvent.click(second, {ctrlKey: true});
    expect(session.history.model.getSnapshot().selection.ids.size).toBe(1);
    await user.keyboard('{Control>}c{/Control}');
    await user.click(
      screen.getByRole('button', {name: '슬라이드 1 앞에 삽입'}),
    );
    expect(session.history.model.getSnapshot().selection.caret).toBe(0);
    await user.keyboard('{Control>}v{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(
      original.length + 1,
    );
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(
      original[0]?.lines,
    );
    expect(session.history.snapshot.song.slides[0]?.id).not.toBe(
      original[0]?.id,
    );
  });
  it('passes modified Enter from the title field to window shortcuts', async () => {
    await editorSetup();
    const title = screen.getByRole('textbox', {name: '곡 제목'});
    const keys = vi.fn();
    window.addEventListener('keydown', keys);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      expect(fireEvent.keyDown(title, {key: 'Enter', [modifier]: true})).toBe(
        true,
      );
    }
    window.removeEventListener('keydown', keys);
    expect(keys).toHaveBeenCalledTimes(4);
    expect(fireEvent.keyDown(title, {key: 'Enter'})).toBe(false);
  });

  it('coalesces typing and flushes when the lyrics field loses focus', async () => {
    const {edits} = await editorSetup();
    cursor(lyrics(), 0);
    for (const value of ['a', 'ab', 'abc']) {
      fireEvent.change(lyrics(), {target: {value}});
    }
    expect(edits).toHaveLength(0);
    await act(async () => {
      fireEvent.blur(lyrics());
      await Promise.resolve();
    });
    expect(edits).toHaveLength(1);
  });
  it.each([
    {key: 'Backspace', code: 'Backspace'},
    {key: 'z', code: 'KeyZ', ctrlKey: true},
    {key: 'y', code: 'KeyY', ctrlKey: true},
  ])('allows selection after a no-op $code command', async command => {
    const {session, first} = await editorSetup();
    cursor(lyrics(), 0);
    fireEvent.keyDown(lyrics(), command);
    cursor(lyrics(2), 2);
    fireEvent.keyDown(lyrics(2), {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(session.history.snapshot.song.slides[0]).toEqual(
      first.song.slides[0],
    );
    expect(lyrics(2).value).toBe(
      first.song.slides[1]?.lines.join('\n').slice(0, 2),
    );
    expect(document.activeElement).toBe(lyrics(3));
  });
  it('saves input and dispatches physical undo and both redo bindings', async () => {
    const {user, session, documents, first} = await editorSetup();
    await user.click(lyrics());
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      await user.keyboard('{End}abc');
    } finally {
      clock.mockRestore();
    }
    await act(() => session.flush());
    const text = lyrics().value;
    expect(documents.get(first.song.id)?.song.slides[0]?.lines.join('\n')).toBe(
      text,
    );
    fireEvent.keyDown(lyrics(), {key: 'ㅈ', code: 'KeyZ', ctrlKey: true});
    expect(lyrics().value).toBe(first.song.slides[0]?.lines.join('\n'));
    fireEvent.keyDown(lyrics(), {key: 'y', code: 'KeyY', ctrlKey: true});
    expect(lyrics().value).toBe(text);
    fireEvent.keyDown(lyrics(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    fireEvent.keyDown(lyrics(), {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(lyrics().value).toBe(text);
  });

  it('splits at Ctrl Enter and restores the caret', async () => {
    const {session} = await editorSetup();
    cursor(lyrics(2), 2);
    fireEvent.keyDown(lyrics(2), {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(screen.getAllByRole('textbox', {name: /^슬라이드 /})).toHaveLength(
      3,
    );
    expect(document.activeElement).toBe(lyrics(3));
    expect(lyrics(3).selectionStart).toBe(0);
    fireEvent.keyDown(lyrics(3), {
      key: 'N',
      code: 'KeyN',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(screen.getAllByRole('textbox', {name: /^슬라이드 /})).toHaveLength(
      4,
    );
    expect(document.activeElement).toBe(lyrics(4));
    expect(lyrics(4).value).toBe('');
    await act(() => session.flush());
  });

  it('splits at a line end without carrying the newline to either slide', async () => {
    await editorSetup();
    const input = lyrics(2);
    const first = '첫째 줄 가사';
    const second = '둘째 줄 가사';
    fireEvent.change(input, {target: {value: `${first}\n${second}`}});
    cursor(input, first.length);
    fireEvent.keyDown(input, {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(lyrics(2).value).toBe(first);
    expect(lyrics(3).value).toBe(second);
    expect(document.activeElement).toBe(lyrics(3));
    expect(lyrics(3).selectionStart).toBe(0);
  });

  it('starts lines, splits explicitly, and merges with Backspace', async () => {
    const {user} = await editorSetup();
    cursor(lyrics(), lyrics().value.length);
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('textbox', {name: /^슬라이드 /})).toHaveLength(
      2,
    );
    expect(lyrics().value.endsWith('\n')).toBe(true);
    fireEvent.keyDown(lyrics(), {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(screen.getAllByRole('textbox', {name: /^슬라이드 /})).toHaveLength(
      3,
    );
    expect(document.activeElement).toBe(lyrics(2));
    await user.keyboard('{Backspace}');
    expect(screen.getAllByRole('textbox', {name: /^슬라이드 /})).toHaveLength(
      2,
    );
    expect(document.activeElement).toBe(lyrics());
    expect(lyrics().selectionStart).toBe(lyrics().value.length);
  });

  it('splits pasted paragraphs and crosses block boundaries with arrow keys', async () => {
    await editorSetup();
    cursor(lyrics(), 0, lyrics().value.length);
    fireEvent.paste(lyrics(), {
      clipboardData: {getData: () => 'first\n\nsecond'},
    });
    expect(lyrics().value).toBe('first');
    expect(lyrics(2).value).toBe('second');
    cursor(lyrics(2), 3);
    fireEvent.keyDown(lyrics(2), {key: 'ArrowUp'});
    expect(document.activeElement).toBe(lyrics());
    expect(lyrics().selectionStart).toBe(3);
    fireEvent.keyDown(lyrics(), {key: 'ArrowDown'});
    expect(document.activeElement).toBe(lyrics(2));
    expect(lyrics(2).selectionStart).toBe(3);
    fireEvent.keyDown(lyrics(2), {key: 'ArrowUp', shiftKey: true});
    expect(document.activeElement).toBe(lyrics(2));
  });

  it('prepares the edited slide picture during text paste', async () => {
    const {session} = await editorSetup();
    const prepare = vi.spyOn(pictures, 'prepareEditedLyrics');
    const input = lyrics();
    cursor(input, 0, input.value.length);
    fireEvent.paste(input, {clipboardData: {getData: () => 'Pasted lyric'}});
    expect(input.value).toBe('Pasted lyric');
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'Pasted lyric',
    ]);
    expect(prepare).toHaveBeenCalledWith(expect.anything(), ['Pasted lyric']);
    prepare.mockRestore();
  });

  it.each([{types: ['image/png']}, {types: ['text/plain']}])(
    'keeps selected lyrics when a paste has empty plain text with types $types',
    async ({types}) => {
      const {session, edits} = await editorSetup();
      const input = lyrics();
      const text = input.value;
      const song = session.history.snapshot.song;
      expect(text.length).toBeGreaterThan(2);
      cursor(input, 1, 3);
      fireEvent.paste(input, {clipboardData: {types, getData: () => ''}});
      expect(input.value).toBe(text);
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3]);
      expect(session.history.snapshot.song).toBe(song);
      expect(edits).toHaveLength(0);
    },
  );

  it('leaves composition and unrelated modifier commands to their owners', async () => {
    const {session, edits} = await editorSetup();
    cursor(lyrics(), 1);
    fireEvent.compositionStart(lyrics());
    fireEvent.keyDown(lyrics(), {key: 'Enter', code: 'Enter', ctrlKey: true});
    fireEvent.compositionEnd(lyrics());
    fireEvent.keyDown(lyrics(), {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
      isComposing: true,
    });
    fireEvent.keyDown(lyrics(), {key: 'Enter', code: 'Enter', altKey: true});
    fireEvent.keyDown(lyrics(), {key: 'N', code: 'KeyN', ctrlKey: true});
    expect(session.history.snapshot.song.slides).toHaveLength(2);
    expect(edits).toHaveLength(0);
  });

  it('keeps history through view unmounts and protects read-only documents', async () => {
    const {store, session, view, user} = await editorSetup();
    await user.click(lyrics());
    await user.keyboard('a');
    await act(() => session.flush());
    view.rerender(<SongEditor store={store} />);
    expect(session.history.canUndo).toBe(true);
    act(() => store.open(editorSong(5, 'readOnly')));
    expect(lyrics().readOnly).toBe(true);
    expect(screen.queryByRole('button', {name: '1절 1'})).toBeNull();
    const before = lyrics().value;
    await user.type(lyrics(), 'x');
    expect(lyrics().value).toBe(before);
  });
});

it('adds a closing title at the end caret, edits its spacing, duplicates and undoes deletion', async () => {
  const {session, user, store} = await editorSetup();
  render(<SlideInspector store={store} />);
  const original = session.history.snapshot.song.slides;
  await user.click(
    screen.getByRole('button', {name: '마지막 슬라이드 뒤에 삽입'}),
  );
  const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
  fireEvent.contextMenu(surface);
  await user.click(screen.getByRole('menuitem', {name: '제목 슬라이드 추가'}));
  const closing = session.history.snapshot.song.slides.at(-1);
  expect(closing).toMatchObject({
    titleSlide: true,
    lines: [session.title.nextValue],
  });
  expect(session.history.snapshot.song.slides.slice(0, -1)).toEqual(original);
  const spacing = screen.getByRole('spinbutton', {name: '부제 자간'});
  await user.clear(spacing);
  await user.type(spacing, '12{Enter}');
  expect(session.history.snapshot.song.slides.at(-1)?.titleLayout).toEqual({
    titleTracking: 0,
    subtitleTracking: 12,
  });
  fireEvent.contextMenu(surface);
  await user.click(screen.getByRole('menuitem', {name: /복제/}));
  expect(session.history.snapshot.song.slides.at(-1)).toMatchObject({
    titleSlide: true,
    titleLayout: {titleTracking: 0, subtitleTracking: 12},
  });
  expect(session.history.snapshot.song.slides.at(-1)?.id).not.toBe(closing?.id);
  act(() => surface.focus());
  await user.keyboard('{Delete}');
  expect(session.history.snapshot.song.slides).toHaveLength(
    original.length + 1,
  );
  act(() => session.edit('undo'));
  expect(session.history.snapshot.song.slides).toHaveLength(
    original.length + 2,
  );
});
