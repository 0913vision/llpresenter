import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {LiveCommand} from '@core/schema/liveCommand';
import {emptyLiveState, type SlideLayer} from '@core/schema/live';
import type {ShowService} from '@core/schema/showService';
import type {Slide} from '@core/schema/slide';
import {slideTiles} from '@core/slides/tiles';
import {useThemes} from '@renderer/platform/themes';
import {useLive} from '@renderer/session/live';
import {
  applyService,
  hasSlideHotKey,
  openItem,
  openNextItem,
  openPreviousItem,
  outputBoundarySlide,
  outputHotKey,
  outputNext,
  outputPrevious,
  outputSlideOf,
  outputTile,
  revealLiveItem,
  selectTile,
  setAtLastSlide,
  startServiceSync,
  tilesOf,
  useShow,
} from '@renderer/session/show';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';
import {themes} from '@fixtures/core/themeOutput';
import {
  sampleService,
  seedSampleService,
} from '@fixtures/renderer/session/sampleService';

const sent: LiveCommand[] = [];
let stop = (): void => undefined;

const commands = () =>
  sent.flatMap(command =>
    command.type === 'live.batch' ? command.commands : [command],
  );
const shown = () =>
  commands().flatMap(command =>
    command.type === 'slide.show' ? [command.slide] : [],
  );
const updates = () =>
  commands().flatMap(command =>
    command.type === 'slide.update' ? [command.slide] : [],
  );

/** Puts a slide on output, as main answers a command. */
function goLive(itemId: string, index: number): SlideLayer {
  const slide = outputSlideOf({itemId, index});
  if (slide === null) throw new Error(`No slide ${itemId} ${index}`);
  const state = emptyLiveState();
  useLive.setState({
    state: {...state, layers: {...state.layers, slide}},
    lastStartedItemId: itemId,
  });
  sent.length = 0;
  return slide;
}

/** A service of one item of each list of slides, in order. */
function serviceOf(
  decks: Readonly<Record<string, readonly Slide[]>>,
  revision = 2,
): ShowService {
  return {
    ...sampleService,
    revision,
    rows: Object.keys(decks).map(id => ({kind: 'song', id, title: id})),
    tiles: Object.fromEntries(
      Object.entries(decks).map(([id, slides]) => [
        id,
        slideTiles(slides, {kind: 'song', title: id}),
      ]),
    ),
  };
}

beforeEach(() => {
  sent.length = 0;
  window.llp = mockLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
    service: {
      get: () => new Promise<ShowService>(() => undefined),
      subscribe: () => () => undefined,
    },
  });
  useThemes.setState({themes: themes()});
  useLive.setState({state: null, lastStartedItemId: null, commandVersion: 0});
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0, bibleSources: []});
  stop = startServiceSync();
});

afterEach(() => {
  stop();
  setAtLastSlide('stop');
  delete window.llp;
});

describe('opening and selecting', () => {
  it('opens an item at its first slide, and keeps the selection of an open one', () => {
    openItem('song-morning');
    selectTile(2);
    openItem('song-morning');
    expect(useShow.getState().selectedTile).toBe(2);
    openItem('song-river');
    expect(useShow.getState().selectedTile).toBe(0);
    expect(sent).toEqual([]);
  });

  it('goes through the items that can be output, without outputting', () => {
    openItem('song-morning');
    openNextItem();
    expect(useShow.getState().openItemId).toBe('song-river');
    openPreviousItem();
    openPreviousItem();
    openPreviousItem();
    expect(useShow.getState().openItemId).toBe('countdown');
    expect(sent).toEqual([]);
  });

  it('comes back to the live item after another was looked at', () => {
    openItem('song-morning');
    goLive('song-morning', 1);
    openItem('psalm-23');
    revealLiveItem();
    expect(useShow.getState().openItemId).toBe('song-morning');
  });

  it('keeps the selected slide when slides are added before it', () => {
    const [first, second, third] = [1, 2, 3].map(number =>
      lyricsSlide(number, `${number}`),
    );
    if (!first || !second || !third) throw new Error('Missing slides');
    applyService(serviceOf({deck: [first, second]}));
    openItem('deck');
    selectTile(1);
    applyService(serviceOf({deck: [third, first, second]}, 3));
    expect(useShow.getState().selectedTile).toBe(2);
  });

  it('starts over in another service, and drops an older revision of this one', () => {
    openItem('song-morning');
    applyService({...sampleService, revision: 0, rows: []});
    expect(useShow.getState().openItemId).toBe('song-morning');
    applyService({...sampleService, id: 'other', revision: 0});
    expect(useShow.getState().openItemId).toBeNull();
    expect(sent).toEqual([]);
  });
});

describe('outputting a slide', () => {
  it('sends the slide with its texts, its theme, and what comes next', () => {
    outputTile({itemId: 'song-morning', index: 0});
    const [tile, next] = tilesOf('song-morning');
    expect(shown()).toHaveLength(1);
    expect(shown()[0]).toMatchObject({
      itemId: 'song-morning',
      position: 0,
      slideId: tile?.slide.id,
      theme: tile?.slide.theme,
      texts: tile?.slide.texts,
      next: next?.slide.texts['가사'],
    });
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 0,
    });
  });

  it('sends nothing for a slide that is not there', () => {
    outputTile({itemId: 'song-morning', index: 9});
    expect(sent).toEqual([]);
  });

  it('starts an item only once', () => {
    const id = '00000000-0000-4000-8000-00000000000a';
    applyService(
      serviceOf({[id]: [lyricsSlide(1, '가'), lyricsSlide(2, '나')]}),
    );
    outputTile({itemId: id, index: 0});
    expect(commands().map(command => command.type)).toContain('item.start');
    goLive(id, 0);
    outputTile({itemId: id, index: 1});
    expect(commands().map(command => command.type)).not.toContain('item.start');
  });

  it('shows the first or the last slide of the open item, not of the live one', () => {
    openItem('song-river');
    goLive('song-morning', 1);
    outputBoundarySlide('last');
    outputBoundarySlide('first');
    expect(shown().map(slide => [slide.itemId, slide.position])).toEqual([
      ['song-river', 2],
      ['song-river', 0],
    ]);
  });
});

describe('next and previous', () => {
  it('goes to the slides beside the live one', () => {
    openItem('song-morning');
    goLive('song-morning', 1);
    outputNext();
    goLive('song-morning', 1);
    outputNext();
    expect(shown()[0]?.position).toBe(2);
    goLive('song-morning', 1);
    outputPrevious();
    expect(shown()[0]?.position).toBe(0);
  });

  it('stops after the last slide and keeps the selection', () => {
    openItem('song-morning');
    goLive('song-morning', 3);
    selectTile(3);
    outputNext();
    expect(shown()).toEqual([]);
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 3,
    });
  });

  it('goes on with the next item when that is chosen, over a section', () => {
    setAtLastSlide('nextItem');
    openItem('song-river');
    goLive('song-river', 2);
    outputNext();
    expect(shown()[0]).toMatchObject({itemId: 'psalm-23', position: 0});
    expect(useShow.getState().openItemId).toBe('psalm-23');
  });

  it('goes back to the last slide of the item before when that is chosen', () => {
    setAtLastSlide('nextItem');
    openItem('song-river');
    goLive('song-river', 0);
    outputPrevious();
    expect(shown()[0]).toMatchObject({itemId: 'song-morning', position: 3});
  });

  it('does nothing after the last slide of the service', () => {
    setAtLastSlide('nextItem');
    openItem('psalm-23');
    goLive('psalm-23', 2);
    outputNext();
    expect(shown()).toEqual([]);
  });

  it('starts an open item that is not live at its first slide', () => {
    goLive('song-morning', 1);
    openItem('song-river');
    outputNext();
    expect(shown()[0]).toMatchObject({itemId: 'song-river', position: 0});
  });

  it('plays the transition of the live slide backward on the way back', () => {
    const transition = {kind: 'push', dir: 'left', sec: 1} as const;
    applyService(
      serviceOf({
        deck: [lyricsSlide(1, '가'), lyricsSlide(2, '나', {transition})],
      }),
    );
    openItem('deck');
    goLive('deck', 1);
    outputPrevious();
    expect(shown()[0]).toMatchObject({
      position: 0,
      reverseTransition: transition,
    });
    outputTile({itemId: 'deck', index: 1});
    expect(shown()[1]?.transition).toEqual(transition);
    expect(shown()[1]?.reverseTransition).toBeUndefined();
  });
});

describe('the next text', () => {
  it('is empty after the last slide, and the first slide of the next item when going on', () => {
    applyService(
      serviceOf({
        one: [lyricsSlide(1, '가')],
        맑은시냇물: [lyricsSlide(2, '나')],
      }),
    );
    const slide = goLive('one', 0);
    expect(slide.next).toBeNull();
    setAtLastSlide('nextItem');
    expect(updates()).toHaveLength(1);
    expect(updates()[0]?.next).toBe('나');
  });

  it('is the own text of the next slide when it has one', () => {
    applyService(
      serviceOf({
        deck: [lyricsSlide(1, '가'), lyricsSlide(2, '나', {next: '후렴으로'})],
      }),
    );
    expect(outputSlideOf({itemId: 'deck', index: 0})?.next).toBe('후렴으로');
  });

  it('follows an edit of the next slide while a slide is live', () => {
    applyService(
      serviceOf({deck: [lyricsSlide(1, '가'), lyricsSlide(2, '나')]}),
    );
    goLive('deck', 0);
    applyService(
      serviceOf({deck: [lyricsSlide(1, '가'), lyricsSlide(2, '다')]}, 3),
    );
    expect(updates()).toHaveLength(1);
    expect(updates()[0]?.next).toBe('다');
    expect(shown()).toEqual([]);
  });
});

describe('a live slide that is edited', () => {
  it('follows its text without being shown again', () => {
    applyService(
      serviceOf({deck: [lyricsSlide(1, '가'), lyricsSlide(2, '나')]}),
    );
    goLive('deck', 0);
    applyService(
      serviceOf({deck: [lyricsSlide(1, '가나'), lyricsSlide(2, '나')]}, 3),
    );
    expect(updates()[0]?.texts).toEqual({가사: '가나'});
    expect(shown()).toEqual([]);
  });

  it('sends nothing when nothing it shows changed', () => {
    const deck = [lyricsSlide(1, '가'), lyricsSlide(2, '나')];
    applyService(serviceOf({deck}));
    goLive('deck', 0);
    applyService(serviceOf({deck: deck.map(slide => ({...slide}))}, 3));
    expect(sent).toEqual([]);
  });

  it('goes on with the slide after it when it was deleted', () => {
    const [first, second, third] = [1, 2, 3].map(number =>
      lyricsSlide(number, `${number}`),
    );
    if (!first || !second || !third) throw new Error('Missing slides');
    applyService(serviceOf({deck: [first, second, third]}));
    openItem('deck');
    goLive('deck', 1);
    applyService(serviceOf({deck: [first, third]}, 3));
    outputNext();
    expect(shown()[0]?.slideId).toBe(third.id);
  });

  it('goes on with the next item when its item was deleted', () => {
    const decks = {
      one: [lyricsSlide(1, '가')],
      two: [lyricsSlide(2, '나'), lyricsSlide(3, '다')],
      three: [lyricsSlide(4, '라')],
    };
    applyService(serviceOf(decks));
    openItem('two');
    goLive('two', 0);
    applyService(serviceOf({one: decks.one, three: decks.three}, 3));
    outputNext();
    expect(shown()[0]).toMatchObject({itemId: 'three', position: 0});
  });
});

describe('hot keys', () => {
  const decks = () => ({
    one: [lyricsSlide(1, '가', {hotKey: 'KeyQ'}), lyricsSlide(2, '나')],
    two: [lyricsSlide(3, '다'), lyricsSlide(4, '라', {hotKey: 'KeyW'})],
  });

  it('shows the slide with the key in the open item', () => {
    applyService(serviceOf(decks()));
    goLive('one', 0);
    openItem('two');
    expect(hasSlideHotKey('KeyW')).toBe(true);
    expect(outputHotKey('KeyW')).toBe(true);
    expect(shown()[0]).toMatchObject({itemId: 'two', position: 1});
    expect(useShow.getState().selectedTile).toBe(1);
  });

  it('does nothing for a key of another item, or with no item open', () => {
    applyService(serviceOf(decks()));
    goLive('one', 0);
    openItem('two');
    expect(outputHotKey('KeyQ')).toBe(false);
    useShow.setState({openItemId: null});
    expect(outputHotKey('KeyQ')).toBe(false);
    expect(sent).toEqual([]);
  });
});

it('sends the slides that are sized together with the live one', () => {
  const slides = [1, 2, 3].map(number =>
    slideOf(number, 'scripture', {texts: {본문: `${number}`}}),
  );
  applyService(serviceOf({word: [...slides, lyricsSlide(4, '가')]}));
  const together = outputSlideOf({itemId: 'word', index: 0})?.peers;
  expect(together?.map(peer => peer.texts['본문'])).toEqual(['1', '2', '3']);
  expect(outputSlideOf({itemId: 'word', index: 3})?.peers).toBeUndefined();
});
