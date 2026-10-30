import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {parseGroupedSong, type GroupedSong} from '@core/schema/groupedSong';
import {expectSuccess} from '@core/schema/testHelpers';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {
  BACKSPACE_REFUSAL_MESSAGE,
  SongBlock,
  type EditorFocus,
} from './SongBlock';
import {linearSlidesOf} from './blockEdits';
import {SongSession} from './songSession';

afterEach(resetTooltips);

function createGroupedSong(unnamed = false): GroupedSong {
  return expectSuccess(
    parseGroupedSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 2,
        id: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
        title: '테스트 찬송',
        groups: [
          {
            id: '11111111-1111-4111-a111-111111111111',
            name: unnamed ? '' : '1절',
            slides: [{lines: ['첫째 줄']}, {lines: ['둘째 줄']}],
          },
          {
            id: '22222222-2222-4222-a222-222222222222',
            name: '후렴',
            slides: [{lines: ['후렴 줄']}],
          },
        ],
      }),
      'memory.llsong',
    ),
  ).data;
}

function blockLyrics(number: number): HTMLTextAreaElement {
  const input = screen.getByRole('textbox', {name: `슬라이드 ${number} 가사`});
  if (!(input instanceof HTMLTextAreaElement)) throw new Error('No lyrics');
  return input;
}

function renderBlock(
  block: number,
  song: GroupedSong = createGroupedSong(),
  options: {
    readonly onOpen?: (anchor: HTMLElement, block: number) => void;
    readonly editable?: boolean;
    readonly locked?: boolean;
    readonly active?: boolean;
  } = {},
) {
  const api = fakeLlpApi();
  const session = new SongSession({
    document: {song, revision: 1, access: 'editable'},
    api: api.content,
    changed: vi.fn(),
    problem: vi.fn(),
  });
  const focus: {current: EditorFocus} = {
    current: {
      inputs: [],
      requested: false,
      composing: false,
      restoring: false,
    },
  };
  const slides = linearSlidesOf(song);
  const slide = slides[block];
  if (slide === undefined) throw new Error('Missing slide');
  const onOpen = options.onOpen ?? vi.fn();

  const result = render(
    <SongBlock
      slide={slide}
      block={block}
      session={session}
      focus={focus}
      active={options.active ?? false}
      locked={options.locked ?? false}
      editable={options.editable ?? true}
      color="teal"
      expanded={false}
      onOpen={onOpen}
      top={block * 80}
    />,
  );
  return {...result, session, focus, slide, onOpen};
}

describe('SongBlock', () => {
  it('renders group header / label tag on first slide of a named group', () => {
    renderBlock(0);
    expect(screen.getByRole('button', {name: /1절/})).toBeDefined();
  });

  it('renders 이름표 placeholder on first slide of an unnamed group', () => {
    renderBlock(0, createGroupedSong(true));
    expect(screen.getByRole('button', {name: /이름표/})).toBeDefined();
  });

  it('omits label tag on non-first slide of a group when inactive', () => {
    renderBlock(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders split button on non-first slide when active and opens label menu on click', () => {
    const api = fakeLlpApi();
    const song = createGroupedSong();
    const session = new SongSession({
      document: {song, revision: 1, access: 'editable'},
      api: api.content,
      changed: vi.fn(),
      problem: vi.fn(),
    });
    const focus: {current: EditorFocus} = {
      current: {
        inputs: [],
        requested: false,
        composing: false,
        restoring: false,
      },
    };
    const slides = linearSlidesOf(song);
    const slide = slides[1];
    if (slide === undefined) throw new Error('Missing slide');
    const onOpen = vi.fn();

    render(
      <SongBlock
        slide={slide}
        block={1}
        session={session}
        focus={focus}
        active={true}
        locked={false}
        editable={true}
        color="teal"
        expanded={false}
        onOpen={onOpen}
        top={80}
      />,
    );
    const splitButton = screen.getByRole('button', {name: '새 그룹'});
    expect(splitButton).toBeDefined();
    fireEvent.click(splitButton);
    expect(onOpen).toHaveBeenCalledWith(splitButton, 1);
  });

  it('refuses Backspace at start of first slide and displays refusal tooltip', () => {
    const {session} = renderBlock(0);
    const input = blockLyrics(1);
    act(() => {
      input.focus();
      input.setSelectionRange(0, 0);
      fireEvent.select(input);
    });
    fireEvent.keyDown(input, {key: 'Backspace', code: 'Backspace'});
    expect(screen.getByRole('tooltip').textContent).toBe(
      BACKSPACE_REFUSAL_MESSAGE,
    );
    expect(session.history.snapshot.song.groups[0]?.slides).toHaveLength(2);
  });

  it('merges on Backspace at start of non-first slide within the group', () => {
    const {session} = renderBlock(1);
    const input = blockLyrics(2);
    act(() => {
      input.focus();
      input.setSelectionRange(0, 0);
      fireEvent.select(input);
    });
    fireEvent.keyDown(input, {key: 'Backspace', code: 'Backspace'});
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(session.history.snapshot.song.groups[0]?.slides).toHaveLength(1);
    expect(session.history.snapshot.song.groups[0]?.slides[0]?.lines).toEqual([
      '첫째 줄',
      '둘째 줄',
    ]);
  });

  it('does not show refusal tooltip on plain focus or hover over first slide', async () => {
    renderBlock(0);
    const input = screen.getByRole('textbox', {name: '슬라이드 1 가사'});
    act(() => {
      input.focus();
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    const tooltip = await hoverForTooltip(input);
    expect(tooltip).toBeNull();
  });

  it('ignores modified keyboard activation on the new group button', () => {
    const onOpen = vi.fn();
    renderBlock(1, createGroupedSong(), {onOpen, active: true});
    const button = screen.getByRole('button', {name: '새 그룹'});
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of [' ', 'Enter']) {
        fireEvent.keyDown(button, {key, [modifier]: true});
        fireEvent.keyUp(button, {key});
        fireEvent.click(button, {detail: 0});
      }
    }
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(button, {detail: 1, ctrlKey: true});
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(button, 1);
  });

  it('opens label menu via Ctrl+G keyboard shortcut on the active slide', () => {
    const onOpen = vi.fn();
    renderBlock(1, createGroupedSong(), {onOpen, active: true});
    const splitButton = screen.getByRole('button', {name: '새 그룹'});
    const input = blockLyrics(2);
    act(() => {
      input.focus();
    });
    fireEvent.keyDown(input, {key: 'g', code: 'KeyG', ctrlKey: true});
    expect(onOpen).toHaveBeenCalledWith(splitButton, 1);
  });

  it('opens label menu via Ctrl+G anchored to label button on group-start slide', () => {
    const onOpen = vi.fn();
    renderBlock(0, createGroupedSong(), {onOpen, active: true});
    const labelButton = screen.getByRole('button', {name: /1절/});
    const input = blockLyrics(1);
    act(() => {
      input.focus();
    });
    fireEvent.keyDown(input, {key: 'g', code: 'KeyG', ctrlKey: true});
    expect(onOpen).toHaveBeenCalledWith(labelButton, 0);
  });

  it('does nothing on Ctrl+G keyboard shortcut when block is not editable', () => {
    const onOpen = vi.fn();
    renderBlock(1, createGroupedSong(), {
      onOpen,
      editable: false,
      active: true,
    });
    const input = blockLyrics(2);
    act(() => {
      input.focus();
    });
    fireEvent.keyDown(input, {key: 'g', code: 'KeyG', ctrlKey: true});
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('moves focus to split button on Shift+Tab from textarea', async () => {
    const user = userEvent.setup();
    renderBlock(1, createGroupedSong(), {active: true, editable: true});
    const splitButton = screen.getByRole('button', {name: '새 그룹'});
    const input = blockLyrics(2);
    input.focus();
    expect(document.activeElement).toBe(input);
    await user.tab({shift: true});
    expect(document.activeElement).toBe(splitButton);
  });
});
