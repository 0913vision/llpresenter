import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {LIVE_STATE_LIMITS} from '@shared/schema/liveLimits';
import {useLive} from '@renderer/state/live';
import {
  applyService,
  openItem,
  outputNext,
  outputPrevious,
  revealLiveItem,
  selectTile,
  useShow,
} from '@renderer/state/show';
import {shownTiles} from '@renderer/state/showLibrary';
import {sampleService} from '../testing/sampleService';
import {openBiblePassage, showBiblePassage} from './actions';
import {panelApi, panelPassage} from './panelTesting';
import {bibleSource} from './source';

beforeEach(() => {
  useShow.setState({
    bibleSource: null,
    librarySong: null,
    openItemId: null,
    selectedTile: 0,
  });
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
  applyService(sampleService);
});
afterEach(() => {
  delete window.llp;
  useShow.setState({bibleSource: null, openItemId: null});
});

describe('Bible slide source', () => {
  it('keeps long verses within output line limits without splitting Unicode pairs', () => {
    const text = '𠀀'.repeat(LIVE_STATE_LIMITS.textCharacters);
    const source = bibleSource({
      ...panelPassage(),
      verses: [{chapter: 1, verse: 1, text}],
    });
    const lines = source.tiles[0]?.lines ?? [];
    expect(
      lines.every(line => line.length <= LIVE_STATE_LIMITS.textCharacters),
    ).toBe(true);
    expect(
      lines.every(line => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u.test(line)),
    ).toBe(true);
    expect(lines.join('')).toBe(`1 ${text}`);
  });
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
        lines: ['17 Invented verse 17'],
      },
    });
    openBiblePassage({
      ...panelPassage(),
      verses: panelPassage().verses.slice(0, 1),
    });
    expect(useShow.getState().selectedTile).toBe(0);
  });

  it('keeps Bible navigation and reveal available across service refreshes', () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openBiblePassage(panelPassage());
    const itemId = useShow.getState().openItemId;
    if (itemId === null) throw new Error('Missing Bible source');
    applyService({...sampleService, revision: 2});
    applyService(null);
    expect(useShow.getState().openItemId).toBe(itemId);
    const live = emptyLiveState();
    useLive.setState({
      state: {
        ...live,
        layers: {
          ...live.layers,
          slide: {itemId, position: 1, label: null, lines: []},
        },
      },
    });
    outputNext();
    outputPrevious();
    expect(
      fixture.send.mock.calls.map(([command]) =>
        command.type === 'slide.show' ? command.slide.position : null,
      ),
    ).toEqual([2, 0]);
    openItem('other');
    revealLiveItem();
    expect(useShow.getState().openItemId).toBe(itemId);
    useShow.setState({openItemId: 'missing'});
    expect(shownTiles(useShow.getState())).toBeUndefined();
  });
});
