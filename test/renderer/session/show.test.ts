import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {bibleSource} from '@core/bible/source';
import {sectionCardOf} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import {createSongSlideId, createSongId, createSlideId} from '@core/schema/ids';
import {liveTileIndex} from '@renderer/session/showLibrary';
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
  stageSlideOf,
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
    ['song', 'song'],
    ['title', 'blank'],
    ['bible', 'bible'],
    ['sermon', 'blank'],
    ['creed', 'blank'],
    ['notice', 'ad'],
    ['standby', 'blank'],
    ['media', 'media'],
  ] as const)(
    'uses the same next caption on first output and refresh for %s',
    (_name, kind) => {
      const row =
        kind === 'song' || kind === 'bible' || kind === 'media'
          ? {kind, id: 'deck', title: 'Deck'}
          : {
              kind: 'slides' as const,
              id: 'deck',
              title: 'Deck',
              form: 'blank' as const,
            };
      const first = {
        label: null,
        labelColor: 'none' as const,
        lines: ['First'],
      };
      const second = {
        label: null,
        labelColor: 'none' as const,
        lines: ['Next'],
        ...(kind === 'ad' ? {kind: 'ad' as const, name: 'Notice'} : {}),
        ...(kind === 'bible' ? {biblePart: 1} : {}),
      };
      applyService({
        ...sampleService,
        revision: 2,
        rows: [row],
        tiles: {deck: [first, second]},
      });
      const initial = stageSlideOf({itemId: 'deck', index: 0});
      expect(initial?.next).toBeDefined();
      setLive('deck', 0);
      sent.length = 0;
      setAtLastSlide('stop');
      const refreshed = sent.find(command => command.type === 'stage.next.set');
      expect(refreshed?.next).toEqual(initial?.next);
    },
  );
  it('refreshes a live background without showing the slide or clearing blackout', () => {
    const background = {mediaId: 'background', loop: true};
    const rows = sampleService.rows.map(row =>
      row.id === 'song-morning' && row.kind === 'song'
        ? {...row, background}
        : row,
    );
    applyService({...sampleService, revision: 2, rows});
    setLive('song-morning', 0);
    const state = useLive.getState().state;
    if (state === null) throw Error('Missing live state');
    useLive.setState({
      state: {
        ...state,
        blackScreen: true,
        themeItem: {id: 'song-morning', kind: 'song', source: 'service'},
      },
    });
    sent.length = 0;
    const explicit = rows.map(row =>
      row.id === 'song-morning' && row.kind === 'song'
        ? {...row, backgroundExplicit: true as const}
        : row,
    );
    applyService({...sampleService, revision: 3, rows: explicit});
    expect(sent).toContainEqual({type: 'media.show', media: background});
    expect(sent).toContainEqual({type: 'themes.refresh'});
    expect(slides()).toEqual([]);
    expect(useLive.getState().state?.blackScreen).toBe(true);
    sent.length = 0;
    applyService({...sampleService, revision: 4, rows});
    expect(sent).toContainEqual({type: 'themes.refresh'});
    expect(slides()).toEqual([]);
  });
  it.each(['song', 'slides', 'bible'] as const)(
    'keeps output, identity and next truthful when a live %s slide is edited, moved, deleted and restored',
    kind => {
      const songId = createSongId('30000000-0000-4000-8000-000000000001');
      const tiles = [0, 1, 2].map(index => ({
        label: `verse ${index}`,
        labelColor: 'none' as const,
        lines: [`line ${index}`],
        ...(kind === 'song'
          ? {
              sourceSlide: {
                songId,
                slideId: createSongSlideId(
                  `30000000-0000-4000-8000-00000000000${index + 1}`,
                ),
              },
            }
          : {
              sourceSlideId: createSlideId(
                `40000000-0000-4000-8000-00000000000${index + 1}`,
              ),
              ...(kind === 'bible' ? {biblePart: 1} : {}),
            }),
      }));
      const [first, second, third] = tiles;
      if (!first || !second || !third) throw Error('Missing tiles');
      const row =
        kind === 'song'
          ? ({kind, id: 'deck', title: 'Deck'} as const)
          : kind === 'bible'
            ? ({kind, id: 'deck', title: 'Deck'} as const)
            : ({kind, id: 'deck', title: 'Deck', form: 'blank'} as const);
      const service = {
        ...sampleService,
        rows: [
          row,
          {kind: 'song' as const, id: 'following', title: 'Following'},
        ],
        tiles: {deck: tiles, following: [first]},
      };
      applyService({...service, revision: 2});
      useShow.setState({openItemId: 'deck'});
      setLive('deck', 1);
      const live = useLive.getState().state;
      if (!live) throw Error('Missing live state');
      const edited = {...second, lines: ['edited']};
      const inserted = {
        label: null,
        labelColor: 'none' as const,
        lines: ['inserted'],
      };
      const changedNext = {...third, lines: ['updated next']};
      const moved = [inserted, first, edited, changedNext];
      applyService({
        ...service,
        revision: 3,
        tiles: {...service.tiles, deck: moved},
      });
      expect(liveTileIndex(useShow.getState(), live.layers.slide)).toBe(2);
      expect(useLive.getState().state).toBe(live);
      expect(sent.at(-1)).toMatchObject({
        type: 'stage.next.set',
        next: {lines: ['updated next']},
      });
      sent.length = 0;
      applyService({
        ...service,
        revision: 4,
        tiles: {...service.tiles, deck: [inserted, first, changedNext]},
      });
      expect(liveTileIndex(useShow.getState(), live.layers.slide)).toBeNull();
      expect(useLive.getState().state).toBe(live);
      expect(sent.filter(command => command.type === 'stage.next.set')).toEqual(
        [],
      );
      outputNext();
      expect(slides().at(-1)).toMatchObject({
        slide: {itemId: 'deck', position: 2, lines: ['updated next']},
      });
      applyService({
        ...service,
        revision: 5,
        tiles: {...service.tiles, deck: moved},
      });
      expect(liveTileIndex(useShow.getState(), live.layers.slide)).toBe(2);
    },
  );

  it('continues to the following item after deleting the live item and restores its marker on undo', () => {
    const songId = createSongId('30000000-0000-4000-8000-000000000001');
    const tiles = [0, 1].map(index => ({
      label: null,
      labelColor: 'none' as const,
      lines: [`line ${index}`],
      sourceSlide: {
        songId,
        slideId: createSongSlideId(
          `30000000-0000-4000-8000-00000000000${index + 1}`,
        ),
      },
    }));
    const [first] = tiles;
    if (!first) throw Error('Missing tile');
    const service = {
      ...sampleService,
      rows: [
        {kind: 'song' as const, id: 'deck', title: 'Deck'},
        {kind: 'song' as const, id: 'following', title: 'Following'},
      ],
      tiles: {deck: tiles, following: [first]},
    };
    applyService({...service, revision: 2});
    useShow.setState({openItemId: 'deck'});
    setLive('deck', 1);
    const live = useLive.getState().state;
    if (!live) throw Error('Missing live state');
    applyService({
      ...service,
      revision: 3,
      rows: service.rows.slice(1),
      tiles: {following: [first]},
    });
    expect(useLive.getState().state).toBe(live);
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {lines: ['line 0']},
    });
    outputNext();
    expect(slides().at(-1)).toMatchObject({
      slide: {itemId: 'following', position: 0},
    });
    applyService({...service, revision: 4});
    useShow.setState({openItemId: 'deck'});
    expect(liveTileIndex(useShow.getState(), live.layers.slide)).toBe(1);
  });

  it.each(['bible', 'sermon', 'liturgy'] as const)(
    'retains and restores a removed %s item without slide IDs',
    kind => {
      const row =
        kind === 'liturgy'
          ? {
              kind: 'slides' as const,
              id: 'deck',
              title: 'Liturgy',
              form: 'blank' as const,
              liturgy: {kind: 'creed' as const, translation: 'new' as const},
            }
          : {
              kind: 'bible' as const,
              id: 'deck',
              title: 'Passage',
              ...(kind === 'sermon' ? {sermonTitle: 'Sermon'} : {}),
            };
      const first = {
        label: 'first',
        labelColor: 'none' as const,
        lines: ['first'],
      };
      const second = {
        label: 'second',
        labelColor: 'none' as const,
        lines: ['second'],
      };
      const service = {
        ...sampleService,
        rows: [
          row,
          {kind: 'song' as const, id: 'following', title: 'Following'},
        ],
        tiles: {deck: [first, second], following: [first]},
      };
      applyService({...service, revision: 2});
      useShow.setState({openItemId: 'deck'});
      setLive('deck', 1);
      const live = useLive.getState().state;
      if (!live) throw Error('Missing live state');
      applyService({
        ...service,
        revision: 3,
        rows: service.rows.slice(1),
        tiles: {following: [first]},
      });
      expect(useLive.getState().state).toBe(live);
      expect(sent.at(-1)).toMatchObject({
        type: 'stage.next.set',
        next: {lines: ['first']},
      });
      outputNext();
      expect(slides().at(-1)).toMatchObject({
        slide: {itemId: 'following', position: 0},
      });
      applyService({...service, revision: 4});
      useShow.setState({openItemId: 'deck'});
      expect(liveTileIndex(useShow.getState(), live.layers.slide)).toBe(1);
    },
  );

  it('sends the slide command before notifying show and live state subscribers', () => {
    const events: string[] = [];
    window.llp = mockLlpApi({
      live: {send: () => events.push('command')},
    });
    setLive('song-morning', 0);
    useShow.setState({openItemId: 'song-morning', selectedTile: 0});
    const stopShow = useShow.subscribe(() => events.push('show'));
    const stopLive = useLive.subscribe(() => events.push('live'));
    try {
      outputNext();
      expect(events[0]).toBe('command');
      expect(events).toContain('show');
      expect(events).toContain('live');
      expect(useShow.getState().selectedTile).toBe(1);
    } finally {
      stopShow();
      stopLive();
    }
  });

  it('sends the next item before opening its grid', () => {
    const events: string[] = [];
    window.llp = mockLlpApi({live: {send: () => events.push('command')}});
    setAtLastSlide('nextItem');
    setLive('song-morning', 3);
    useShow.setState({openItemId: 'song-morning', selectedTile: 3});
    events.length = 0;
    const stop = useShow.subscribe(() => events.push('show'));
    try {
      outputNext();
      expect(events[0]).toBe('command');
      expect(useShow.getState().openItemId).toBe('song-river');
    } finally {
      stop();
    }
  });

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

  it('clears the selection when a different service has the same item ids without changing output', () => {
    useShow.setState({openItemId: 'song-morning', selectedTile: 2});
    setLive('song-morning', 1);
    const live = useLive.getState().state;
    applyService({...sampleService, revision: 2});
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 2,
    });
    sent.length = 0;
    applyService({...sampleService, id: 'copy', revision: 1});
    expect(useShow.getState()).toMatchObject({
      openItemId: null,
      selectedTile: 0,
    });
    expect(useLive.getState().state).toBe(live);
    expect(sent).toEqual([]);
  });

  it('clears an open library song when the service changes', () => {
    const songId = createSongId('30000000-0000-4000-8000-000000000001');
    useShow.setState({
      librarySong: {
        songId,
        songRevision: 1,
        title: 'Song',
        readOnly: false,
        tiles: [],
      },
      openItemId: `library:${songId}`,
      selectedTile: 1,
    });
    applyService({...sampleService, revision: 2});
    expect(useShow.getState().openItemId).toBe(`library:${songId}`);
    applyService({...sampleService, id: 'copy', revision: 1});
    expect(useShow.getState()).toMatchObject({
      openItemId: null,
      selectedTile: 0,
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

  it('skips headers on the way to the next Bible item and leaves its end blank', () => {
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

  it('suppresses passage boundaries while keeping middle verses and navigation', () => {
    const id = 'sermon-item';
    const title = {
      label: null,
      labelColor: 'none' as const,
      lines: ['Sermon'],
      sermonTitle: true as const,
    };
    const verse = {
      label: '3:16',
      labelColor: 'none' as const,
      lines: ['Verse'],
    };
    useShow.setState({
      rows: [
        {kind: 'bible', id, title: 'Sermon', sermonTitle: 'Sermon'},
        {kind: 'bible', id: 'next-passage', title: 'John 3:17'},
      ],
      tiles: {
        [id]: [title, verse, {...verse, lines: ['Second verse']}, title],
        'next-passage': [{...verse, lines: ['Next passage']}],
      },
    });
    setAtLastSlide('nextItem');
    outputTile({itemId: id, index: 0});
    expect(slides().at(-1)?.slide.next).toBeUndefined();
    outputTile({itemId: id, index: 1});
    expect(slides().at(-1)?.slide.next?.lines).toEqual(['Second verse']);
    outputTile({itemId: id, index: 2});
    expect(slides().at(-1)?.slide.next).toBeUndefined();
    setLive(id, 2);
    outputNext();
    expect(slides().at(-1)?.slide.position).toBe(3);
    outputTile({itemId: id, index: 3});
    expect(slides().at(-1)?.slide.next?.lines).toEqual(['Next passage']);
  });

  it.each(['bible', 'slides'] as const)(
    'suppresses the end of a %s passage and legacy opening title',
    kind => {
      const title = {
        kind: 'slides' as const,
        id: 'title',
        title: 'Sermon',
        form: 'blank' as const,
        theme: SERMON_TITLE_THEME_ID,
      };
      const passage =
        kind === 'bible'
          ? {kind: 'bible' as const, id: 'passage', title: 'John 3:16'}
          : {
              kind: 'slides' as const,
              id: 'passage',
              title: 'John 3:16',
              form: 'blank' as const,
            };
      const tile = {label: null, labelColor: 'none' as const, lines: ['Text']};
      useShow.setState({
        rows: [title, passage, {kind: 'song', id: 'song-river', title: 'Song'}],
        tiles: {
          title: [tile, tile],
          passage: [tile, {...tile, lines: ['Second verse']}],
          'song-river': [tile],
        },
      });
      setAtLastSlide('nextItem');
      outputTile({itemId: 'title', index: 0});
      expect(slides().at(-1)?.slide.next?.lines).toEqual(['Text']);
      outputTile({itemId: 'title', index: 1});
      expect(slides().at(-1)?.slide.next).toBeUndefined();
      outputTile({itemId: 'passage', index: 0});
      expect(slides().at(-1)?.slide.next?.lines).toEqual(['Second verse']);
      outputTile({itemId: 'passage', index: 1});
      expect(slides().at(-1)?.slide.next).toBeUndefined();
    },
  );

  it('shows the reference for the next passage from a song', () => {
    const tile = {label: null, labelColor: 'none' as const, lines: ['Text']};
    useShow.setState({
      rows: [
        {kind: 'song', id: 'song', title: 'Song'},
        {kind: 'bible', id: 'passage', title: 'John 3:16'},
      ],
      tiles: {song: [tile], passage: [tile]},
    });
    setAtLastSlide('nextItem');
    outputTile({itemId: 'song', index: 0});
    expect(slides().at(-1)?.slide.next?.stageReference).toBe('John 3:16');
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
    setLive('song-morning', 3);
    setAtLastSlide('nextItem');
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
    setLive('song-morning', 3);
    setAtLastSlide('nextItem');
    openItem('song-river');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {title: section.name, lines: []},
    });
  });

  it('refreshes the next ad cue when only the title behind a section card changes', () => {
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
      name: 'First title',
      lines: ['Body'],
    };
    setLive('song-morning', 3);
    setAtLastSlide('nextItem');
    applyService({
      ...sampleService,
      revision: 2,
      tiles: {...sampleService.tiles, 'song-river': [card, body]},
    });
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {title: section.name, adTitle: 'First title'},
    });
    sent.length = 0;
    applyService({
      ...sampleService,
      revision: 3,
      tiles: {
        ...sampleService.tiles,
        'song-river': [card, {...body, name: 'Renamed title'}],
      },
    });
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {title: section.name, adTitle: 'Renamed title'},
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

  it('marks the standby item and the end of the service for the stage', () => {
    useShow.setState(state => ({
      rows: [
        ...state.rows,
        {
          kind: 'slides',
          id: 'waiting',
          title: '대기 화면',
          form: 'blank',
        },
      ],
      tiles: {
        ...state.tiles,
        waiting: [{label: null, labelColor: 'none', lines: ['']}],
      },
    }));
    setLive('song-morning', 3);
    setAtLastSlide('nextItem');
    useShow.setState(state => ({
      rows: state.rows.filter(
        row => row.id === 'song-morning' || row.id === 'waiting',
      ),
    }));
    openItem('song-morning');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {stageStandby: true},
    });
    setLive('waiting', 0);
    openItem('waiting');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      next: {stageStandby: true},
    });
  });

  it('does not infer standby from an unavailable live projection', () => {
    useShow.setState({tiles: {}});
    setLive('song-morning', 0);
    sent.length = 0;
    openItem('song-morning');
    expect(sent.filter(command => command.type === 'stage.next.set')).toEqual(
      [],
    );
  });

  it('keeps stage next anchored to the live slide while browsing another item', () => {
    setLive('song-morning', 1);
    openItem('song-morning');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      itemId: 'song-morning',
      position: 1,
      next: {lines: sampleService.tiles['song-morning']?.[2]?.lines},
    });
    sent.length = 0;
    openItem('song-river');
    selectTile(1);
    expect(sent.filter(command => command.type === 'stage.next.set')).toEqual(
      [],
    );
    expect(slides()).toEqual([]);
    outputTile({itemId: 'song-river', index: 0});
    expect(slides().at(-1)).toMatchObject({
      slide: {
        itemId: 'song-river',
        next: {lines: sampleService.tiles['song-river']?.[1]?.lines},
      },
    });
  });

  it('keeps the next service item anchored to the last live slide while browsing', () => {
    setLive('song-morning', 3);
    setAtLastSlide('nextItem');
    expect(sent.at(-1)).toMatchObject({
      type: 'stage.next.set',
      itemId: 'song-morning',
      next: {
        itemKind: 'song',
        lines: sampleService.tiles['song-river']?.[0]?.lines,
      },
    });
    sent.length = 0;
    openItem('psalm-23');
    expect(sent.filter(command => command.type === 'stage.next.set')).toEqual(
      [],
    );
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
      slide: {itemId: grown.id, position: 3, label: '요3:18'},
    });
    outputPrevious();
    expect(slides().at(-1)).toMatchObject({
      type: 'slide.show',
      slide: {itemId: grown.id, position: 1, label: '요3:16'},
    });
  });

  it('keeps an open passage across refreshes and retains live passage keys after closing the service', async () => {
    const source = bibleSource(await passage('요한복음 3:16-18'));
    useShow.setState({bibleSource: source, openItemId: source.id});

    applyService({...sampleService, revision: 2});
    expect(useShow.getState().openItemId).toBe(source.id);
    applyService(null);
    expect(useShow.getState().openItemId).toBeNull();
    setLive(source.id, 1);
    outputNext();
    outputPrevious();
    expect(slides().map(command => command.slide.position)).toEqual([2, 0]);
    openItem('other');
    revealLiveItem();

    expect(useShow.getState().openItemId).toBe(source.id);
  });
});
