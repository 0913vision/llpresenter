import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {bibleSource} from '@core/bible/source';
import {sectionCardOf} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {createSongSlideId, createSongId} from '@core/schema/ids';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {
  applyService,
  hasSlideHotKey,
  openNextItem,
  openPreviousItem,
  outputHotKey,
  outputBoundarySlide,
  revealLiveItem,
  selectTile,
  openItem,
  outputNext,
  outputPrevious,
  outputTile,
  setAtLastSlide,
  useShow,
} from '@renderer/session/show';
import {
  sampleService,
  seedSampleService,
} from '@fixtures/renderer/session/sampleService';

const sent: LiveCommand[] = [];
const slides = () =>
  sent
    .flatMap(command =>
      command.type === 'live.batch' ? command.commands : [command],
    )
    .filter(command => command.type === 'slide.show');

function installApi(): void {
  window.llp = mockLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
  });
}

function setLive(itemId: string, position: number): void {
  const state: LiveState = {
    ...emptyLiveState(),
    layers: {
      ...emptyLiveState().layers,
      slide: {itemId, position, label: null, lines: ['x']},
    },
  };
  useLive.setState({state});
}

beforeEach(() => {
  sent.length = 0;
  installApi();
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

afterEach(() => {
  setAtLastSlide('stop');
  delete window.llp;
  vi.restoreAllMocks();
});

describe('show state', () => {
  it.each([
    ['first', 0],
    ['last', 2],
  ] as const)(
    'outputs the %s slide of the open item, not the live item',
    (boundary, position) => {
      setLive('song-morning', 1);
      openItem('song-river');
      outputBoundarySlide(boundary);
      expect(slides()).toHaveLength(1);
      expect(slides()[0]).toMatchObject({
        slide: {itemId: 'song-river', position},
      });
      expect(useShow.getState().selectedTile).toBe(position);
    },
  );

  it('does nothing at a boundary without an open, nonempty presentation', () => {
    setLive('song-morning', 1);
    for (const itemId of [null, 'before', 'missing']) {
      useShow.setState({openItemId: itemId});
      outputBoundarySlide('first');
      outputBoundarySlide('last');
    }
    expect(slides()).toEqual([]);
  });

  it('opens an item with its first tile selected', () => {
    useShow.setState({selectedTile: 3});
    openItem('song-morning');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 0,
    });
  });

  it('keeps the tile selection when the open item is opened again', () => {
    openItem('song-morning');
    selectTile(2);
    openItem('song-morning');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 2,
    });
  });

  it('sends slide.show for a tile and shows it selected', () => {
    outputTile({itemId: 'song-morning', index: 1});
    expect(slides()).toEqual([
      {
        type: 'slide.show',
        slide: {
          itemId: 'song-morning',
          position: 1,
          sequenceLength: 4,
          label: '후렴',
          lines: ['함께 불러요 함께 노래해요'],
          next: {label: '2절', lines: ['낮은 언덕을 넘어', '바람이 불어 오네']},
        },
      },
    ]);
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 1,
    });
  });

  it('previews the same following item as the next key when continuous mode is on', () => {
    setAtLastSlide('nextItem');
    outputTile({itemId: 'song-morning', index: 3});
    expect(slides().at(-1)).toMatchObject({
      slide: {
        next: {
          itemKind: 'song',
          lines: sampleService.tiles['song-river']?.[0]?.lines,
        },
      },
    });
    sent.length = 0;
    setAtLastSlide('stop');
    outputTile({itemId: 'song-morning', index: 3});
    const command = slides().at(-1);
    expect(command?.slide.next).toBeUndefined();
  });

  it('uses the current slide effect when going back but the target effect on a direct click', () => {
    const target = {kind: 'wipe' as const, dir: 'left' as const, sec: 3};
    const leaving = {kind: 'push' as const, dir: 'right' as const, sec: 1.5};
    useShow.setState(state => ({
      tiles: {
        ...state.tiles,
        'song-morning': (state.tiles['song-morning'] ?? []).map(
          (tile, index) => (index === 0 ? {...tile, transition: target} : tile),
        ),
      },
    }));
    setLive('song-morning', 1);
    const state = useLive.getState().state;
    if (state?.layers.slide == null) {
      throw Error('Missing live slide');
    }
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {...state.layers.slide, transition: leaving},
        },
      },
    });
    openItem('song-morning');
    outputPrevious();
    expect(slides().at(-1)?.slide).toMatchObject({
      position: 0,
      transition: target,
      reverseTransition: leaving,
    });
    outputTile({itemId: 'song-morning', index: 0});
    expect(slides().at(-1)?.slide).toMatchObject({
      position: 0,
      transition: target,
    });
    expect(slides().at(-1)?.slide.reverseTransition).toBeUndefined();
  });

  it('continues to the last slide of the previous item when enabled', () => {
    setLive('song-river', 0);
    openItem('song-river');
    outputPrevious();
    expect(slides()).toHaveLength(0);
    setAtLastSlide('nextItem');
    outputPrevious();
    expect(slides().at(-1)).toMatchObject({
      slide: {itemId: 'song-morning', position: 3},
    });
    expect(useShow.getState().openItemId).toBe('song-morning');
  });

  it('continues backwards through a live media item to the previous song', () => {
    const media = {mediaId: 'media-one', loop: false};
    useShow.setState(state => ({
      rows: [
        {kind: 'song', id: 'song-morning', title: 'A'},
        {kind: 'media', id: 'countdown', title: 'M'},
        {kind: 'song', id: 'song-river', title: 'B'},
      ],
      tiles: {
        ...state.tiles,
        countdown: [{label: null, labelColor: 'none', lines: [], media}],
      },
    }));
    setLive('song-river', 0);
    openItem('song-river');
    setAtLastSlide('nextItem');
    outputPrevious();
    const command = sent.at(-1);
    if (command?.type !== 'live.batch') throw Error('Missing media batch');
    expect(command.commands).toContainEqual({type: 'media.show', media});
    useLive.setState({
      state: {
        ...emptyLiveState(),
        themeItem: {id: 'countdown', kind: 'media', source: 'service'},
        layers: {...emptyLiveState().layers, media: {...media, startedAt: 0}},
      },
    });
    outputPrevious();
    expect(slides().at(-1)).toMatchObject({
      slide: {itemId: 'song-morning', position: 3},
    });
  });

  it('skips headers on the way to the next Bible item and leaves the end empty', () => {
    setAtLastSlide('nextItem');
    outputTile({itemId: 'song-river', index: 2});
    expect(slides().at(-1)).toMatchObject({
      slide: {
        next: {
          itemKind: 'bible',
          lines: sampleService.tiles['psalm-23']?.[0]?.lines,
        },
      },
    });
    sent.length = 0;
    outputTile({itemId: 'psalm-23', index: 2});
    expect(slides().at(-1)?.slide.next).toBeUndefined();
  });

  it.each(['before', 'after'] as const)(
    'shows the adjacent sermon title on the last Bible slide when it is %s',
    position => {
      const bible = {kind: 'bible' as const, id: 'psalm-23', title: 'Passage'};
      const sermon = {
        kind: 'slides' as const,
        id: 'sermon',
        title: 'Sermon',
        form: 'blank' as const,
        theme: SERMON_TITLE_THEME_ID,
      };
      useShow.setState(state => ({
        rows: position === 'before' ? [sermon, bible] : [bible, sermon],
        tiles: {
          ...state.tiles,
          sermon: [
            {
              label: null,
              labelColor: 'none',
              lines: ['Sermon title', 'English subtitle'],
            },
          ],
        },
      }));
      setAtLastSlide('stop');
      outputTile({itemId: 'psalm-23', index: 2});
      expect(slides().at(-1)?.slide.next).toEqual({
        label: null,
        lines: ['Sermon title'],
        sermonTitle: true,
      });
      outputTile({itemId: 'psalm-23', index: 1});
      expect(slides().at(-1)?.slide.next).not.toHaveProperty('sermonTitle');
      setLive('psalm-23', 2);
      applyService({
        ...sampleService,
        revision: 3,
        rows: position === 'before' ? [sermon, bible] : [bible, sermon],
        tiles: {
          ...sampleService.tiles,
          sermon: [
            {
              label: null,
              labelColor: 'none',
              lines: ['Updated title', 'English'],
            },
          ],
        },
      });
      expect(sent.at(-1)).toMatchObject({
        type: 'stage.next.set',
        next: {lines: ['Updated title'], sermonTitle: true},
      });
    },
  );

  it('does not add a sermon preview when a Bible item is not adjacent to the sermon', () => {
    useShow.setState(state => ({
      rows: [
        {kind: 'bible', id: 'psalm-23', title: 'Passage'},
        {kind: 'header', id: 'gap', title: 'Gap'},
        {
          kind: 'slides',
          id: 'sermon',
          title: 'Sermon',
          form: 'blank',
          theme: SERMON_TITLE_THEME_ID,
        },
      ],
      tiles: {
        ...state.tiles,
        sermon: [{label: null, labelColor: 'none', lines: ['Title']}],
      },
    }));
    outputTile({itemId: 'psalm-23', index: 2});
    expect(slides().at(-1)?.slide.next).not.toHaveProperty('sermonTitle');
  });

  it('updates the stage preview when continuous navigation changes while a slide is live', () => {
    setLive('song-morning', 3);
    openItem('song-morning');
    sent.length = 0;
    setAtLastSlide('nextItem');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      itemId: 'song-morning',
      position: 3,
      next: {
        itemKind: 'song',
        lines: sampleService.tiles['song-river']?.[0]?.lines,
      },
    });
  });

  it('updates the next preview with only the opening card name', () => {
    const section = SUNDAY_SECTIONS[1];
    if (!section) throw Error('Missing section');
    const card = {
      label: section.name,
      labelColor: 'none' as const,
      lines: [section.english],
      sectionCard: sectionCardOf(section),
    };
    const body = {
      label: null,
      labelColor: 'none' as const,
      lines: ['First body line', 'Second body line'],
    };
    useShow.setState(state => ({
      tiles: {...state.tiles, 'song-river': [card, body]},
    }));
    setLive('song-morning', 1);
    openItem('song-river');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {title: section.name, lines: []},
    });
  });

  it('omits the content slide title from an opening card preview', () => {
    const section = SUNDAY_SECTIONS[1];
    if (!section) throw Error('Missing section');
    const card = {
      label: section.name,
      labelColor: 'none' as const,
      lines: [section.english],
      sectionCard: sectionCardOf(section),
    };
    const body = {
      label: null,
      labelColor: 'none' as const,
      kind: 'ad' as const,
      name: 'Notice title',
      lines: ['Body'],
    };
    useShow.setState(state => ({
      tiles: {...state.tiles, 'song-river': [card, body]},
    }));
    setLive('song-morning', 1);
    openItem('song-river');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {title: section.name, lines: []},
    });
  });

  it('refreshes the next notice with its number and title only', () => {
    const common = {
      kind: 'ad' as const,
      label: null,
      labelColor: 'none' as const,
    };
    useShow.setState(state => ({
      tiles: {
        ...state.tiles,
        'song-river': [
          {...common, name: 'First', lines: ['First body']},
          {...common, name: 'Second', lines: ['Second body']},
        ],
      },
    }));
    setLive('song-river', 0);
    openItem('song-river');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {title: '2. Second', lines: []},
    });
  });

  it('updates stage next when the open item changes without changing the live slide', () => {
    setLive('song-morning', 1);
    openItem('song-river');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      itemId: 'song-morning',
      position: 1,
      next: {
        itemKind: 'song',
        lines: sampleService.tiles['song-river']?.[0]?.lines,
      },
    });
    expect(slides()).toEqual([]);
  });

  it('queues the latest continuous preference even before the live state echoes', () => {
    setLive('song-morning', 3);
    openItem('song-morning');
    sent.length = 0;
    setAtLastSlide('nextItem');
    setAtLastSlide('nextItem');
    setAtLastSlide('stop');
    setAtLastSlide('stop');
    expect(sent).toHaveLength(2);
    expect(sent).toMatchObject([
      {type: 'stage.next.set', next: {itemKind: 'song'}},
      {type: 'stage.next.set', next: null},
    ]);
  });

  it('does not resend a preview already present on the live slide', () => {
    const first = sampleService.tiles['song-river']?.[0];
    if (first === undefined) throw Error('Missing fixture');
    const state = emptyLiveState();
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {
            itemId: 'song-morning',
            position: 3,
            label: null,
            lines: ['x'],
            next: {label: first.label, lines: first.lines, itemKind: 'song'},
          },
        },
      },
    });
    useShow.setState({openItemId: 'song-morning'});
    sent.length = 0;
    setAtLastSlide('nextItem');
    expect(sent).toEqual([]);
  });

  it('sends nothing for a tile that does not exist', () => {
    outputTile({itemId: 'song-morning', index: 99});
    outputTile({itemId: 'missing', index: 0});
    expect(slides()).toHaveLength(0);
  });

  it('outputs the tile after the live one with next', () => {
    setLive('song-morning', 1);
    outputNext();
    expect(slides()[0]).toMatchObject({
      slide: {itemId: 'song-morning', position: 2},
    });
  });

  it('stops after the last tile, does not move on to the next item, and keeps the selection', () => {
    openItem('song-morning');
    outputTile({itemId: 'song-morning', index: 3});
    sent.length = 0;
    setLive('song-morning', 3);
    outputNext();
    expect(slides()).toHaveLength(0);
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 3,
    });
  });

  it('starts the next item on its first tile after the last tile with 다음 항목, and opens it', () => {
    setAtLastSlide('nextItem');
    openItem('song-morning');
    setLive('song-morning', 3);
    outputNext();
    expect(slides().at(-1)).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-river', position: 0},
    });
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-river',
      selectedTile: 0,
    });
  });

  it('skips a 구역 row between two items with 다음 항목', () => {
    setAtLastSlide('nextItem');
    const rows = useShow.getState().rows.map(row => row.id);
    expect(rows.indexOf('word')).toBeGreaterThan(rows.indexOf('song-river'));
    openItem('song-river');
    setLive('song-river', 2);
    outputNext();
    expect(slides().at(-1)).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'psalm-23'},
    });
  });

  it('does nothing on the last tile of the last item with 다음 항목', () => {
    setAtLastSlide('nextItem');
    openItem('closing');
    const last = useShow.getState().rows.at(-1);
    expect(last?.id).toBe('closing');
    setLive('closing', 99);
    outputNext();
    expect(slides()).toHaveLength(0);
  });

  it('still stops after the last tile when 정지 is chosen again', () => {
    setAtLastSlide('nextItem');
    setAtLastSlide('stop');
    openItem('song-morning');
    setLive('song-morning', 3);
    outputNext();
    expect(slides()).toHaveLength(0);
  });

  it('outputs the first tile of another open item with next', () => {
    setLive('song-morning', 2);
    openItem('song-river');
    outputNext();
    expect(slides()[0]).toMatchObject({
      slide: {itemId: 'song-river', position: 0},
    });
  });

  it('uses the live slide order even when another item is open', () => {
    setLive('song-morning', 3);
    openItem('song-river');
    outputPrevious();
    expect(slides().at(-1)).toMatchObject({
      slide: {itemId: 'song-morning', position: 2},
    });
  });

  it('uses the service order for a quick-run library song', () => {
    const songId = createSongId('30000000-0000-4000-8000-000000000001');
    const sourceTiles = (sampleService.tiles['song-morning'] ?? []).map(
      (tile, index) => ({
        ...tile,
        sourceSlide: {
          songId,
          slideId: createSongSlideId(
            `a0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          ),
        },
      }),
    );
    useShow.setState(state => ({
      tiles: {...state.tiles, 'song-morning': sourceTiles},
      librarySong: {
        songId,
        songRevision: 1,
        title: 'Song',
        readOnly: false,
        tiles: sourceTiles,
        jumpKeys: {},
      },
      openItemId: `library:${songId}`,
    }));
    setLive(`library:${songId}`, 2);
    outputPrevious();
    expect(slides().at(-1)).toMatchObject({
      slide: {itemId: 'song-morning', position: 1},
    });
  });

  it('outputs the tile before the live one with previous', () => {
    setLive('song-morning', 2);
    outputPrevious();
    expect(slides()[0]).toMatchObject({
      slide: {itemId: 'song-morning', position: 1},
    });
  });
});

describe('item keys', () => {
  it('opens the next item that can output without outputting, and selects its first tile', () => {
    openItem('song-river');
    useShow.setState({selectedTile: 2});
    openNextItem();
    expect(useShow.getState()).toMatchObject({
      openItemId: 'psalm-23',
      selectedTile: 0,
    });
    expect(slides()).toHaveLength(0);
  });

  it('opens the previous item and stays at the first one', () => {
    openItem('song-river');
    openPreviousItem();
    expect(useShow.getState().openItemId).toBe('song-morning');
    openItem('countdown');
    openPreviousItem();
    expect(useShow.getState().openItemId).toBe('countdown');
    expect(slides()).toHaveLength(0);
  });

  it('opens the item of the live 장 after another item was looked at', () => {
    setLive('song-morning', 2);
    openItem('song-river');
    revealLiveItem();
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 0,
    });
    expect(slides()).toHaveLength(0);
  });
});

describe('slide hotkeys', () => {
  beforeEach(() => {
    const tiles = useShow.getState().tiles;
    const morningTiles = tiles['song-morning'] ?? [];
    useShow.setState({
      tiles: {
        ...tiles,
        'song-morning': morningTiles.map((tile, i) => {
          if (i === 0) {
            return {
              ...tile,
              hotKey: 'KeyA',
              sourceSlide: {
                songId: createSongId('30000000-0000-4000-8000-000000000001'),
                slideId: createSongSlideId(
                  'a0000000-0000-4000-8000-000000000001',
                ),
              },
            };
          }
          if (i === 1) {
            return {
              ...tile,
              hotKey: 'Digit1',
              sourceSlide: {
                songId: createSongId('30000000-0000-4000-8000-000000000001'),
                slideId: createSongSlideId(
                  'a0000000-0000-4000-8000-000000000001',
                ),
              },
            };
          }
          return tile;
        }),
      },
    });
  });

  it('detects whether active presentation has a matching slide hot key', () => {
    openItem('song-morning');
    expect(hasSlideHotKey('KeyA')).toBe(true);
    expect(hasSlideHotKey('Digit1')).toBe(true);
    expect(hasSlideHotKey('KeyZ')).toBe(false);
  });

  it('outputs the tile for a matching hot key and updates selection', () => {
    openItem('song-morning');
    const result = outputHotKey('KeyA');
    expect(result).toBe(true);
    expect(slides()).toEqual([
      {
        type: 'slide.show',
        slide: {
          itemId: 'song-morning',
          position: 0,
          sequenceLength: 4,
          label: '1절',
          lines: ['아침이 밝아 오네', '새로운 노래를 부르리'],
          next: {
            label: '후렴',
            lines: ['함께 불러요 함께 노래해요'],
          },
        },
      },
    ]);
    expect(useShow.getState().selectedTile).toBe(0);
  });

  it('returns false and outputs nothing for unmatched hot key', () => {
    openItem('song-morning');
    const result = outputHotKey('KeyZ');
    expect(result).toBe(false);
    expect(slides()).toHaveLength(0);
  });

  it('uses the open item in view even when another item is live', () => {
    setLive('song-river', 0);
    openItem('song-morning');
    expect(hasSlideHotKey('KeyA')).toBe(true);
    const result = outputHotKey('KeyA');
    expect(result).toBe(true);
    expect(slides()[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-morning', position: 0},
    });
  });

  it('does nothing when the open item has no tile with the key while the live item has one', () => {
    setLive('song-morning', 0);
    openItem('song-river');
    expect(hasSlideHotKey('KeyA')).toBe(false);
    const result = outputHotKey('KeyA');
    expect(result).toBe(false);
    expect(slides()).toHaveLength(0);
  });

  it('returns false when no item is open or live', () => {
    useShow.setState({openItemId: null});
    expect(hasSlideHotKey('KeyA')).toBe(false);
    expect(outputHotKey('KeyA')).toBe(false);
    expect(slides()).toHaveLength(0);
  });
});

describe('Bible passages', () => {
  async function passage(input: string) {
    const reply = await formLookupReply(lookupRequest(input));
    if (!reply.result.ok) throw Error('Invalid Bible passage fixture');
    return reply.result.value;
  }

  it('supplies the whole passage range when sending either external verse to output', async () => {
    const source = bibleSource(await passage('요한복음 3:16-18'));
    useShow.setState({bibleSource: source, openItemId: source.id});
    for (const index of [0, 1]) {
      outputTile({itemId: source.id, index});
      expect(slides().at(-1)?.slide).toMatchObject({
        kind: 'bible',
        title: source.passage.displayRef,
        position: index,
      });
    }
  });

  it('goes on from the live verse with the next and previous 장 keys after the passage grows', async () => {
    const original = bibleSource(await passage('요한복음 3:16-18'));
    const grown = bibleSource(await passage('요한복음 3:15-18'));
    useShow.setState({
      bibleSource: grown,
      liveBibleSource: original,
      openItemId: grown.id,
      selectedTile: 2,
    });
    setLive(original.id, 1);

    outputNext();
    expect(slides().at(-1)).toMatchObject({
      type: 'slide.show',
      slide: {itemId: grown.id, position: 3, label: '\uC6943:18'},
    });
    outputPrevious();
    expect(slides().at(-1)).toMatchObject({
      type: 'slide.show',
      slide: {itemId: grown.id, position: 1, label: '\uC6943:16'},
    });
  });

  it('keeps an open passage, its 장 keys, and reveal across service refreshes', async () => {
    const source = bibleSource(await passage('요한복음 3:16-18'));
    useShow.setState({bibleSource: source, openItemId: source.id});

    applyService({...sampleService, revision: 2});
    applyService(null);
    expect(useShow.getState().openItemId).toBe(source.id);
    setLive(source.id, 1);
    outputNext();
    outputPrevious();
    expect(slides().map(command => command.slide.position)).toEqual([2, 0]);
    openItem('other');
    revealLiveItem();

    expect(useShow.getState().openItemId).toBe(source.id);
  });
});
