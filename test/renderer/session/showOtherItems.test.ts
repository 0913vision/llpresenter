import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {createNoticeSetId} from '@core/schema/ids';
import type {ShowService} from '@core/schema/showService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {applyService, outputTile, useShow} from '@renderer/session/show';

const NOTICE_ID = createNoticeSetId('5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f');
const SONG = '1f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f601';
const PLAIN_SONG = '2f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f602';
const MEDIA_ITEM = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const NOTICE_ITEM = '4a2b3c5d-6e7f-4081-9ba2-c3d4e5f60718';
const lyric = {label: null, labelColor: 'none', lines: ['가사']} as const;
const service: ShowService = {
  revision: 1,
  id: 'service',
  name: '예배',
  readOnly: false,
  rows: [
    {
      kind: 'song',
      id: SONG,
      title: '배경 있는 곡',
      background: {mediaId: 'song-video', loop: true},
    },
    {kind: 'song', id: PLAIN_SONG, title: '배경 없는 곡'},
    {kind: 'media', id: MEDIA_ITEM, title: '카운트다운'},
    {kind: 'notice', id: NOTICE_ITEM, title: '주일 광고'},
  ],
  tiles: {
    [SONG]: [lyric],
    [PLAIN_SONG]: [lyric],
    [MEDIA_ITEM]: [
      {
        label: null,
        labelColor: 'none',
        lines: ['카운트다운'],
        media: {mediaId: 'countdown-video', loop: true},
      },
    ],
    [NOTICE_ITEM]: [0, 1, 2].map(position => ({
      label: null,
      labelColor: 'none',
      lines: [`광고 ${position + 1}`],
      notice: {noticeId: NOTICE_ID, position},
    })),
  },
  jumpKeys: {},
};
const sent: LiveCommand[] = [];
let answer: (value: ShowService) => void = () => undefined;

function types(): string[] {
  return sent.map(command => command.type);
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
      get: () =>
        new Promise<ShowService>(resolve => {
          answer = resolve;
        }),
      subscribe: () => () => undefined,
    },
  });
  useLive.setState({state: null, lastSlideItemId: null, commandVersion: 0});
  applyService(null);
  applyService(service);
});

afterEach(() => {
  delete window.llp;
});

describe('outputting the tile of a media or 공지 item', () => {
  it('puts the media of a media tile on the media layer, not a slide', () => {
    outputTile({itemId: MEDIA_ITEM, index: 0});
    expect(types()).toEqual(['item.start', 'media.show']);
    expect(sent[1]).toEqual({
      type: 'media.show',
      media: {mediaId: 'countdown-video', loop: true},
    });
    expect(useShow.getState()).toMatchObject({
      openItemId: MEDIA_ITEM,
      selectedTile: 0,
    });
  });

  it('starts the 공지 from the image of the chosen tile', () => {
    outputTile({itemId: NOTICE_ITEM, index: 2});
    expect(sent.at(-1)).toEqual({
      type: 'notice.start',
      noticeId: NOTICE_ID,
      position: 2,
    });
    expect(types()).not.toContain('slide.show');
    expect(useShow.getState().selectedTile).toBe(2);
  });

  it('starts the item once for consecutive tiles of the same 공지', () => {
    outputTile({itemId: NOTICE_ITEM, index: 0});
    outputTile({itemId: NOTICE_ITEM, index: 1});
    outputTile({itemId: NOTICE_ITEM, index: 2});
    expect(types().filter(type => type === 'item.start')).toHaveLength(1);
    expect(types().filter(type => type === 'notice.start')).toHaveLength(3);
  });

  it('starts a song again when it comes back after a media item', () => {
    outputTile({itemId: PLAIN_SONG, index: 0});
    outputTile({itemId: MEDIA_ITEM, index: 0});
    outputTile({itemId: PLAIN_SONG, index: 0});
    expect(
      sent.flatMap(command =>
        command.type === 'item.start' ? [command.itemId] : [],
      ),
    ).toEqual([PLAIN_SONG, MEDIA_ITEM, PLAIN_SONG]);
  });

  it('drops a song whose lookup is still pending when a 공지 tile goes out', async () => {
    outputTile({itemId: SONG, index: 0});
    outputTile({itemId: NOTICE_ITEM, index: 1});
    const before = sent.length;
    answer(service);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sent).toHaveLength(before);
    expect(types()).not.toContain('slide.show');
  });
});
