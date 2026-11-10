import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {parseSong, type Song} from '@core/schema/song';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {
  SongBlock,
  type EditorFocus,
} from '@renderer/features/songs/editor/SongBlock';
import {linearSlidesOf} from '@core/songs/blockEdits';
import {SongSession} from '@renderer/features/songs/editor/songSession';

afterEach(resetTooltips);

function createSong(unnamed = false): Song {
  return expectSuccess(
    parseSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
        title: '테스트 찬송',
        slides: [
          {
            id: fixtureSlideId(1),
            lines: ['첫째 줄'],
            label: unnamed ? undefined : '1절',
          },
          {
            id: fixtureSlideId(2),
            lines: ['둘째 줄'],
            label: unnamed ? undefined : '1절',
          },
          {id: fixtureSlideId(3), lines: ['후렴 줄'], label: '후렴'},
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
  song: Song = createSong(),
  options: {
    readonly onOpen?: (anchor: HTMLElement, block: number) => void;
    readonly editable?: boolean;
    readonly locked?: boolean;
    readonly active?: boolean;
    readonly grid?: boolean;
    readonly onMeasure?: ((id: string, height: number) => void) | undefined;
  } = {},
) {
  const api = mockLlpApi();
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
      color="#5FB8C2"
      expanded={false}
      onOpen={onOpen}
      top={block * 80}
      grid={options.grid ?? false}
      onMeasure={options.onMeasure}
    />,
  );
  return {...result, session, focus, slide, onOpen};
}

describe('SongBlock', () => {
  it.each([4, 6, 12])(
    'measures a %i-line grid field with its thumbnail',
    lineCount => {
      const original = createSong();
      const song = {
        ...original,
        slides: original.slides.map((slide, index) =>
          index === 0
            ? {
                ...slide,
                lines: Array.from(
                  {length: lineCount},
                  (_, line) => `Line ${line + 1}`,
                ),
              }
            : slide,
        ),
      };
      const measure = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          if (this.hasAttribute('data-editor-thumbnail')) {
            return DOMRect.fromRect({height: 100});
          }
          if (this.hasAttribute('data-grid-text')) {
            return DOMRect.fromRect({height: lineCount * 22 + 8});
          }
          return DOMRect.fromRect();
        });
      const onMeasure = vi.fn();
      try {
        const view = renderBlock(0, song, {grid: true, onMeasure});
        expect(blockLyrics(1)).toHaveProperty('rows', lineCount);
        expect(onMeasure).toHaveBeenCalledWith(
          song.slides[0]?.id,
          100 + lineCount * 22 + 8,
        );
        view.unmount();
      } finally {
        measure.mockRestore();
      }
    },
  );

  it('opens the label menu from the only grid band', () => {
    const {onOpen, container} = renderBlock(0, createSong(), {grid: true});
    const band = screen.getByRole('button', {name: '\uC774\uB984\uD45C 1'});
    expect(container.querySelectorAll('[data-editor-thumbnail]')).toHaveLength(
      1,
    );
    expect(screen.queryByRole('button', {name: '1\uC808'})).toBeNull();
    expect(container.textContent.match(/1\uC808/g)).toHaveLength(1);
    fireEvent.click(band);
    expect(onOpen).toHaveBeenCalledWith(band, 0);
  });

  it('renders 이름표 placeholder on an unlabeled slide', () => {
    renderBlock(0, createSong(true));
    expect(screen.getByRole('button', {name: /이름표/})).toBeDefined();
  });

  it('shows the label of every inactive slide', () => {
    renderBlock(1);
    expect(screen.getByRole('button', {name: '1절'})).toBeDefined();
  });

  it('opens the active slide label menu from its chip', () => {
    const api = mockLlpApi();
    const song = createSong();
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
        color="#5FB8C2"
        expanded={false}
        onOpen={onOpen}
        top={80}
      />,
    );
    const splitButton = screen.getByRole('button', {name: '1절'});
    expect(splitButton).toBeDefined();
    fireEvent.click(splitButton);
    expect(onOpen).toHaveBeenCalledWith(splitButton, 1);
  });

  it('keeps Backspace at the first slide start as a harmless no-op', () => {
    const {session} = renderBlock(0);
    const input = blockLyrics(1);
    act(() => {
      input.focus();
      input.setSelectionRange(0, 0);
      fireEvent.select(input);
    });
    fireEvent.keyDown(input, {key: 'Backspace', code: 'Backspace'});
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(session.history.snapshot.song.slides).toHaveLength(3);
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

  it('opens label menu via Ctrl+G keyboard shortcut on the active slide', () => {
    const onOpen = vi.fn();
    renderBlock(1, createSong(), {onOpen, active: true});
    const splitButton = screen.getByRole('button', {name: '1절'});
    const input = blockLyrics(2);
    act(() => {
      input.focus();
    });
    fireEvent.keyDown(input, {key: 'g', code: 'KeyG', ctrlKey: true});
    expect(onOpen).toHaveBeenCalledWith(splitButton, 1);
  });

  it('opens label menu via Ctrl+G anchored to label button on first slide', () => {
    const onOpen = vi.fn();
    renderBlock(0, createSong(), {onOpen, active: true});
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
    renderBlock(1, createSong(), {
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

  it('moves focus to label chip on Shift+Tab from textarea', async () => {
    const user = userEvent.setup();
    renderBlock(1, createSong(), {active: true, editable: true});
    const splitButton = screen.getByRole('button', {name: '1절'});
    const input = blockLyrics(2);
    input.focus();
    expect(document.activeElement).toBe(input);
    await user.tab({shift: true});
    expect(document.activeElement).toBe(splitButton);
  });
});
