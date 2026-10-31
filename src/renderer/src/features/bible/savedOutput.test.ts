import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {bibleVerseTiles} from '@core/bible/bibleTiles';
import {emptyLiveState} from '@core/live/state';
import {createServiceItemId} from '@core/schema/ids';
import type {ShowService} from '@core/schema/showService';
import {useLive} from '@renderer/session/live';
import {
  applyService,
  openItem,
  outputNext,
  outputPrevious,
  outputTile,
  selectTile,
  useShow,
} from '@renderer/session/show';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {panelApi, panelPassage} from '@contracts/ipc/testing/bibleApi';

const saved = createServiceItemId('00000000-0000-4000-8000-000000000001');
const other = createServiceItemId('00000000-0000-4000-8000-000000000002');
const missing = createServiceItemId('00000000-0000-4000-8000-000000000003');
const passage = panelPassage();
const otherPassage = {
  ...passage,
  ref: '요한복음 3:17-18',
  displayRef: '요한복음 3:17-18',
  verses: passage.verses.slice(1),
};

function service(): ShowService {
  return {
    revision: 1,
    id: 'service',
    name: 'Invented service',
    readOnly: false,
    rows: [
      {kind: 'bible', id: saved, title: 'John 3:16-18', bible: passage},
      {kind: 'bible', id: other, title: otherPassage.ref, bible: otherPassage},
      {kind: 'bible', id: missing, title: '시편 1:1', problem: 'missing-bible'},
    ],
    tiles: {
      [saved]: bibleVerseTiles(passage, false),
      [other]: bibleVerseTiles(otherPassage, false),
    },
    jumpKeys: {},
  };
}

beforeEach(() => {
  useShow.setState({
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    librarySong: null,
    openItemId: null,
    selectedTile: 0,
    revision: null,
  });
  useLive.setState({state: emptyLiveState(), lastSlideItemId: null});
  applyService(service());
});

afterEach(() => {
  delete window.llp;
});

describe('saved Bible output history', () => {
  it('adds and promotes normalized saved passages without requiring an ad hoc Bible source', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    expect(bibleSourceFor(useShow.getState(), saved)).toBeNull();
    for (const id of [saved, other, saved]) {
      outputTile({itemId: id, index: 0});
      await vi.waitFor(() =>
        expect(fixture.document().value.recents[0]?.ref).toBe(
          id === saved ? passage.ref : otherPassage.ref,
        ),
      );
    }
    expect(fixture.document().value.recents).toEqual([
      {ref: passage.ref, translation: passage.translation},
      {ref: otherPassage.ref, translation: otherPassage.translation},
    ]);
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: saved, position: 0},
    });
  });

  it('records next and previous saved output once in history while keeping the saved item identity', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openItem(saved);
    outputNext();
    await vi.waitFor(() => expect(fixture.edit).toHaveBeenCalledTimes(1));
    let outputs = 1;
    for (const direction of ['next', 'previous'] as const) {
      const slide = fixture.send.mock.calls.at(-1)?.[0];
      if (slide?.type !== 'slide.show') throw new Error('Missing saved output');
      const live = emptyLiveState();
      useLive.setState({
        state: {...live, layers: {...live.layers, slide: slide.slide}},
      });
      if (direction === 'next') {
        outputNext();
      } else {
        outputPrevious();
      }
      outputs++;
      await vi.waitFor(() =>
        expect(fixture.edit).toHaveBeenCalledTimes(outputs),
      );
    }
    await vi.waitFor(() => expect(fixture.edit).toHaveBeenCalledTimes(3));
    expect(fixture.document().value.recents).toEqual([
      {ref: passage.ref, translation: passage.translation},
    ]);
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: saved, position: 0},
    });
  });

  it('keeps history unchanged for selection, invalid tiles, and unavailable passages', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    openItem(saved);
    selectTile(1);
    outputTile({itemId: saved, index: 999});
    outputTile({itemId: missing, index: 0});
    await Promise.resolve();
    expect(fixture.edit).not.toHaveBeenCalled();
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('accepts an older projection without source metadata without creating a guessed recent entry', async () => {
    const fixture = panelApi();
    window.llp = fixture.api;
    applyService({
      ...service(),
      revision: 2,
      rows: [{kind: 'bible', id: saved, title: passage.ref}],
    });
    outputTile({itemId: saved, index: 0});
    await Promise.resolve();
    expect(fixture.edit).not.toHaveBeenCalled();
    expect(fixture.send.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'slide.show',
    });
  });
});
