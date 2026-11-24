import {afterEach, beforeEach, expect, it} from 'vitest';
import {emptyLiveState} from '@core/schema/live/live';
import {QUICK_BIBLE_TRANSITION} from '@core/bible/quickTransition';
import {
  openBiblePassage,
  showBiblePassage,
} from '@renderer/features/bible/passageActions';
import {useLive} from '@renderer/session/live';
import {selectTile} from '@renderer/session/show/show';
import {bibleSourceFor} from '@renderer/session/show/showLibrary';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {shownText} from '@fixtures/core/liveSlide';
import {useShow} from '@renderer/session/show/showStore';
import {tilesOf} from '@renderer/session/show/showCursor';

async function passage(input: string) {
  const reply = await formLookupReply(lookupRequest(input));
  if (!reply.result.ok) throw new Error('Invalid passage fixture');
  return reply.result.value;
}

function verses(id: string | null) {
  return tilesOf(id ?? '').map(tile => tile.slide.verse?.verse);
}
function ids(id: string) {
  return tilesOf(id).map(tile => tile.slide.id);
}

beforeEach(() => {
  seedSampleService();
  useShow.setState({bibleSources: [], openItemId: null, selectedTile: 0});
  useLive.setState({state: emptyLiveState(), lastStartedItemId: null});
});
afterEach(() => {
  delete window.llp;
});

it('opens a passage without sending it out', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  openBiblePassage(await passage('요한복음 3:16-18'));
  expect(verses(useShow.getState().openItemId)).toEqual([16, 17, 18]);
  expect(fixture.send).not.toHaveBeenCalled();
});

it('sends the selected verse with the transition of the passage', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  const display = {verseNumbers: true, transition: QUICK_BIBLE_TRANSITION};
  const source = openBiblePassage(await passage('요한복음 3:16-18'), display);
  selectTile(2);
  showBiblePassage(source.passage);
  expect(fixture.send).toHaveBeenCalledOnce();
  expect(fixture.send.mock.calls[0]?.[0]).toMatchObject({
    type: 'slide.show',
    slide: {
      itemId: source.id,
      position: 2,
      kind: 'bible',
      transition: QUICK_BIBLE_TRANSITION,
      texts: {본문: '18 Invented book 43, chapter 3, verse 18'},
    },
  });
});

it('keeps the slides of the verses when a passage grows', async () => {
  const first = openBiblePassage(await passage('요한복음 3:16-17'));
  const before = ids(first.id);
  const grown = openBiblePassage(await passage('요한복음 3:16-18'));
  expect(grown.id).toBe(first.id);
  expect(ids(grown.id).slice(0, 2)).toEqual(before);
  expect(verses(grown.id)).toEqual([16, 17, 18]);
});

it('starts another passage at its first verse, also when it shares verses', async () => {
  const first = openBiblePassage(await passage('요한복음 3:16-18'));
  selectTile(2);
  const next = openBiblePassage(await passage('요한복음 3:17-20'));
  expect(next.id).not.toBe(first.id);
  expect(useShow.getState().selectedTile).toBe(0);
  selectTile(1);
  openBiblePassage(await passage('요한복음 3:17-21'));
  expect(useShow.getState().selectedTile).toBe(0);
});

it('stays at the verse when the same passage shows differently', async () => {
  const text = await passage('요한복음 3:16-18');
  openBiblePassage(text, {verseNumbers: true});
  selectTile(1);
  const source = openBiblePassage(text, {verseNumbers: false});
  expect(useShow.getState().selectedTile).toBe(1);
  expect(source.tiles[1]?.slide.texts['본문']).toBe(
    'Invented book 43, chapter 3, verse 17',
  );
});

it('keeps the live passage while others are opened', async () => {
  const live = openBiblePassage(await passage('요한복음 3:16-18'));
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        slide: {itemId: live.id, position: 0, ...shownText('가')},
      },
    },
  });
  for (const input of ['요한복음 4:1', '요한복음 5:1', '요한복음 6:1']) {
    openBiblePassage(await passage(input));
  }
  const view = useShow.getState();
  expect(view.bibleSources).toHaveLength(3);
  expect(bibleSourceFor(view, live.id)?.slides).toBe(live.slides);
});
