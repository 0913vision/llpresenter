import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {parseGroupedSong, type GroupedSong} from '@shared/schema/groupedSong';
import {expectSuccess} from '@shared/schema/testHelpers';
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
      active={false}
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

  it('omits label tag on non-first slide of a group', () => {
    renderBlock(1);
    expect(screen.queryByRole('button')).toBeNull();
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
});
