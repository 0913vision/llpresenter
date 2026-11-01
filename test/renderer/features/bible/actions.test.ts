import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {
  applyService,
  outputPrevious,
  revealLiveItem,
  selectTile,
  useShow,
} from '@renderer/session/show';
import {bibleSourceFor, shownTiles} from '@renderer/session/showLibrary';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {
  openBiblePassage,
  showBiblePassage,
} from '@renderer/features/bible/actions';
import {panelApi, panelPassage} from '@fixtures/contracts/ipc/bibleApi';

beforeEach(() => {
  useShow.setState({
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    librarySong: null,
    openItemId: null,
    selectedTile: 0,
  });
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
  applyService(sampleService);
});
afterEach(() => {
  delete window.llp;
  useShow.setState({
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    openItemId: null,
  });
});

describe('Bible slide source', () => {
  it('retains the numbered live source while preparing the same passage without numbers', () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const passage = panelPassage();
    openBiblePassage(passage);
    selectTile(1);
    showBiblePassage(passage);
    const output = fixture.send.mock.calls.at(-1)?.[0];
    if (output?.type !== 'slide.show') {
      throw new Error('Missing numbered output');
    }
    const numbered = useShow.getState().bibleSource;
    const live = emptyLiveState();
    useLive.setState({
      state: {...live, layers: {...live.layers, slide: output.slide}},
    });
    openBiblePassage(passage, {verseNumbers: false});
    const plain = useShow.getState().bibleSource;
    expect(plain?.id).not.toBe(numbered?.id);
    expect(plain?.tiles[0]?.lines).toEqual(['Invented verse 16']);
    expect(useShow.getState().selectedTile).toBe(1);
    expect(bibleSourceFor(useShow.getState(), output.slide.itemId)).toBe(
      numbered,
    );
    expect(fixture.send).toHaveBeenCalledOnce();
    showBiblePassage(passage);
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: plain?.id, position: 1, lines: ['Invented verse 17']},
    });
  });

  it('retains a requested passage while its output feedback and another preview cross', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    const passageA = panelPassage();
    showBiblePassage(passageA);
    const sentA = fixture.send.mock.calls.at(-1)?.[0];
    if (sentA?.type !== 'slide.show') throw new Error('Missing output A');
    const live = emptyLiveState();
    useLive.setState({
      state: {...live, layers: {...live.layers, slide: sentA.slide}},
    });
    const passageB = {
      ...passageA,
      ref: '요한복음 4:16-18',
      displayRef: '요한복음 4:16-18',
      verses: passageA.verses.map(verse => ({
        ...verse,
        chapter: 4,
        text: `Invented B ${verse.verse}`,
      })),
    };
    openBiblePassage(passageB);
    selectTile(2);
    showBiblePassage(passageB);
    const sentB = fixture.send.mock.calls.at(-1)?.[0];
    if (sentB?.type !== 'slide.show') throw new Error('Missing output B');
    openBiblePassage({
      ...passageA,
      ref: '창세기 1:1',
      displayRef: '창세기 1:1',
    });
    expect(
      bibleSourceFor(useShow.getState(), sentA.slide.itemId),
    ).not.toBeNull();
    useLive.setState({
      state: {...live, layers: {...live.layers, slide: sentB.slide}},
    });
    revealLiveItem();
    expect(useShow.getState().openItemId).toBe(sentB.slide.itemId);
    outputPrevious();
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {
        itemId: sentB.slide.itemId,
        position: 1,
        lines: ['17 Invented B 17'],
      },
    });
    openBiblePassage({
      ...passageA,
      ref: '창세기 1:2',
      displayRef: '창세기 1:2',
    });
    expect(bibleSourceFor(useShow.getState(), sentA.slide.itemId)).toBeNull();
    await vi.waitFor(() =>
      expect(fixture.document().value.recents[0]?.ref).toBe(passageB.ref),
    );
  });
  it.each([true, false])(
    'retains live A apart from later previews for reveal and previous, with early feedback %s',
    async earlyFeedback => {
      const fixture = panelApi();
      window.llp = fixture.api;
      const passageA = panelPassage();
      openBiblePassage(passageA);
      selectTile(2);
      showBiblePassage(passageA);
      const sourceA = useShow.getState().bibleSource;
      if (sourceA === null) throw new Error('Missing output Bible source');
      const live = emptyLiveState();
      const accepted = {
        ...live,
        layers: {
          ...live.layers,
          slide: {
            itemId: sourceA.id,
            position: 2,
            label: '3:18',
            lines: sourceA.tiles[2]?.lines ?? [],
          },
        },
      };
      if (earlyFeedback) useLive.setState({state: accepted});
      await vi.waitFor(() => expect(fixture.edit).toHaveBeenCalledOnce());
      openBiblePassage({
        ...passageA,
        ref: '창세기 1:1',
        displayRef: '창세기 1:1',
      });
      const previewB = useShow.getState().bibleSource;
      if (previewB === null) throw new Error('Missing preview Bible source');
      expect(useShow.getState().liveBibleSource).toBe(
        earlyFeedback ? sourceA : null,
      );
      openBiblePassage({
        ...passageA,
        ref: '창세기 1:2',
        displayRef: '창세기 1:2',
      });
      expect(bibleSourceFor(useShow.getState(), previewB.id)).toBeNull();
      expect(bibleSourceFor(useShow.getState(), sourceA.id)).toBe(sourceA);
      if (!earlyFeedback) useLive.setState({state: accepted});
      revealLiveItem();
      expect(useShow.getState().openItemId).toBe(sourceA.id);
      expect(shownTiles(useShow.getState())).toBe(sourceA.tiles);
      expect(fixture.send).toHaveBeenCalledOnce();
      outputPrevious();
      expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: 'slide.show',
        slide: {
          itemId: sourceA.id,
          position: 1,
          lines: ['17 Invented verse 17'],
        },
      });
      await vi.waitFor(() => expect(fixture.edit).toHaveBeenCalledTimes(2));
      expect(fixture.document().value.recents.map(item => item.ref)).toEqual([
        passageA.ref,
      ]);
      useLive.setState({
        state: {
          ...live,
          layers: {
            ...live.layers,
            slide: {
              itemId: 'song-morning',
              position: 0,
              label: null,
              lines: ['Invented song'],
            },
          },
        },
        lastSlideItemId: 'song-morning',
      });
      openBiblePassage({
        ...passageA,
        ref: '창세기 1:3',
        displayRef: '창세기 1:3',
      });
      expect(useShow.getState().liveBibleSource).toBeNull();
      expect(bibleSourceFor(useShow.getState(), sourceA.id)).toBeNull();
    },
  );
  it('previews without output and shares selected output with Enter and the panel button', () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openBiblePassage(panelPassage());
    expect(shownTiles(useShow.getState())?.map(tile => tile.label)).toEqual([
      '3:16',
      '3:17',
      '3:18',
    ]);
    expect(fixture.send).not.toHaveBeenCalled();
    selectTile(1);
    showBiblePassage(panelPassage());
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'slide.show',
      slide: {
        itemId: useShow.getState().openItemId,
        position: 1,
        label: '3:17',
        reference: '3:17',
        lines: ['17 Invented verse 17'],
        next: {label: '3:18', lines: ['18 Invented verse 18']},
      },
    });
    openBiblePassage({
      ...panelPassage(),
      verses: panelPassage().verses.slice(0, 1),
    });
    expect(useShow.getState().selectedTile).toBe(0);
  });
});
