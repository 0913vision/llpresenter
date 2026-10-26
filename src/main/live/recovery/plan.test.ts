import {describe, expect, it} from 'vitest';
import {createMediaId, createMessageId} from '@shared/schema/ids';
import {
  CAPTIONS,
  IMAGES,
  MAIN,
  NOTICE,
  overlaySettings,
  overlayUuid,
  PROP,
  settingsDocument,
  STAGE,
  TEXT_STYLE,
} from '../testing/overlays';
import {
  HEADER_ITEM,
  MISSING_SONG_ITEM,
  recoveryContent,
  recoveryRecordOf,
  SAVED_AT_MS,
  SERVICE,
  SONG_ITEM,
} from '../testing/recovery';
import {planRecovery} from './plan';

const NDI_SCREEN = overlayUuid(40);
const REMOVED_SCREEN = overlayUuid(41);
const REMOVED_PROP = overlayUuid(42);
const MEDIA = createMediaId(overlayUuid(43));
const FIRST_IMAGE = createMediaId(overlayUuid(30));

function sources() {
  const settings = overlaySettings();
  return {settings: settings.reader, content: recoveryContent(), ...settings};
}

function message(id: number, fields: Record<string, unknown> = {}) {
  return {
    messageId: createMessageId(overlayUuid(id)),
    text: `Fixture message ${id}`,
    targets: [MAIN],
    excludedTargets: [],
    startedAt: SAVED_AT_MS - 1000,
    expiresAt: null,
    ...fields,
  };
}

const LIVE_SLIDE = {
  itemId: SONG_ITEM,
  position: 3,
  label: 'Recorded label',
  lines: ['Recorded line'],
};

describe('recovery plan', () => {
  it('offers nothing for a record of the empty state', () => {
    expect(planRecovery(recoveryRecordOf({}), sources())).toEqual([]);
  });

  it('turns on the saved screens that were on, through their compatible keys', () => {
    const fixture = sources();
    fixture.update(
      settingsDocument('screens', {
        screens: [
          {id: MAIN, name: 'Main', kind: 'audience', method: 'fullscreen'},
          {id: CAPTIONS, name: 'Captions', kind: 'audience', method: 'capture'},
          {id: STAGE, name: 'Stage', kind: 'stage', method: 'window'},
          {id: NDI_SCREEN, name: 'Stream', kind: 'audience', method: 'ndi'},
        ],
      }),
    );
    const record = recoveryRecordOf({
      outputs: {
        main: true,
        [CAPTIONS]: false,
        [STAGE]: true,
        [NDI_SCREEN]: true,
        [REMOVED_SCREEN]: true,
      },
    });
    expect(planRecovery(record, fixture)).toEqual([
      {
        row: {
          kind: 'outputs',
          screens: [
            {screenId: MAIN, name: 'Main'},
            {screenId: STAGE, name: 'Stage'},
          ],
        },
        commands: [
          {type: 'output.set', screenId: MAIN, on: true},
          {type: 'output.set', screenId: STAGE, on: true},
        ],
      },
    ]);
  });

  it('offers the live 슬라이드 by its current tile, with its background', () => {
    const record = recoveryRecordOf({
      layers: {
        slide: LIVE_SLIDE,
        media: {mediaId: MEDIA, loop: true, startedAt: SAVED_AT_MS - 5000},
      },
    });
    expect(planRecovery(record, sources())).toEqual([
      {
        row: {
          kind: 'slide',
          slide: {
            serviceId: SERVICE,
            itemId: SONG_ITEM,
            title: '만복의 근원 하나님',
            position: 3,
            slideCount: 5,
          },
        },
        commands: [
          {
            type: 'slide.show',
            slide: {
              itemId: SONG_ITEM,
              position: 3,
              label: '후렴',
              lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
            },
          },
          {type: 'media.show', media: {mediaId: MEDIA, loop: true}},
        ],
      },
    ]);
  });

  it.each([
    ['no recorded service', LIVE_SLIDE, null],
    ['a service that is gone', LIVE_SLIDE, overlayUuid(44)],
    ['an item that is gone', {...LIVE_SLIDE, itemId: overlayUuid(45)}, SERVICE],
    [
      'an item that is not a song',
      {...LIVE_SLIDE, itemId: HEADER_ITEM},
      SERVICE,
    ],
    [
      'a song that is gone',
      {...LIVE_SLIDE, itemId: MISSING_SONG_ITEM},
      SERVICE,
    ],
    ['a position past the 구성', {...LIVE_SLIDE, position: 5}, SERVICE],
  ])('hides the 슬라이드 row for %s', (_case, slide, serviceId) => {
    const record = recoveryRecordOf({layers: {slide}}, serviceId);
    expect(planRecovery(record, sources())).toEqual([]);
  });

  it('restores what was showing, with the display time each message had left', () => {
    const record = recoveryRecordOf({
      stageMessage: 'Fixture stage note',
      layers: {
        prop: {
          propId: PROP,
          items: [
            {
              propId: PROP,
              content: {kind: 'text', text: 'Old text', style: TEXT_STYLE},
              targets: [MAIN],
            },
            {
              propId: REMOVED_PROP,
              content: {kind: 'image', media: FIRST_IMAGE},
              targets: [MAIN],
            },
          ],
        },
        message: {
          messageId: overlayUuid(1),
          text: 'Fixture message 1',
          items: [
            message(1, {expiresAt: SAVED_AT_MS + 2500}),
            message(2, {targets: 'all', excludedTargets: [STAGE]}),
            message(3, {targets: [CAPTIONS], expiresAt: SAVED_AT_MS}),
            message(4, {targets: [REMOVED_SCREEN]}),
            message(5, {targets: 'all'}),
          ],
        },
        notice: {
          noticeId: NOTICE,
          playback: {
            media: IMAGES,
            position: 0,
            interval: 5,
            loop: false,
            targets: [MAIN],
            startedAt: SAVED_AT_MS - 6000,
            pausedAt: SAVED_AT_MS - 1000,
          },
        },
      },
    });
    expect(planRecovery(record, sources())).toEqual([
      {
        row: {
          kind: 'showing',
          counts: {
            messages: 3,
            props: 1,
            stageMessages: 1,
            notices: 1,
            stageLayouts: 0,
          },
        },
        commands: [
          {type: 'prop.set', propId: PROP, on: true},
          {
            type: 'message.send',
            text: 'Fixture message 1',
            targets: [MAIN],
            duration: 2.5,
          },
          {
            type: 'message.send',
            text: 'Fixture message 2',
            targets: [MAIN, CAPTIONS],
            duration: null,
          },
          {
            type: 'message.send',
            text: 'Fixture message 5',
            targets: 'all',
            duration: null,
          },
          {type: 'stage.message.set', text: 'Fixture stage note'},
          {type: 'notice.start', noticeId: NOTICE, position: 1},
          {type: 'notice.pause'},
        ],
      },
    ]);
  });

  it('restarts a 공지 from the image it showed in its current set', () => {
    const fixture = sources();
    fixture.update(
      settingsDocument('notices', {
        sets: [
          {
            id: NOTICE,
            name: 'Fixture notices',
            media: [IMAGES[2], IMAGES[1]],
            interval: 5,
            loop: true,
            targets: [MAIN],
          },
        ],
      }),
    );
    const playing = (startedAt: number) =>
      recoveryRecordOf({
        layers: {
          notice: {
            noticeId: NOTICE,
            playback: {
              media: IMAGES,
              position: 0,
              interval: 5,
              loop: true,
              targets: [MAIN],
              startedAt,
              pausedAt: null,
            },
          },
        },
      });
    const positionAfter = (elapsedMs: number) =>
      planRecovery(playing(SAVED_AT_MS - elapsedMs), fixture).flatMap(
        ({commands}) => commands,
      );
    expect(positionAfter(11_000)).toEqual([
      {type: 'notice.start', noticeId: NOTICE, position: 0},
    ]);
    expect(positionAfter(6000)).toEqual([
      {type: 'notice.start', noticeId: NOTICE, position: 1},
    ]);
    expect(positionAfter(0)).toEqual([
      {type: 'notice.start', noticeId: NOTICE, position: 0},
    ]);
    fixture.update(settingsDocument('notices', {sets: []}));
    expect(planRecovery(playing(SAVED_AT_MS), fixture)).toEqual([]);
  });

  it('keeps an M2 message layer as it was', () => {
    const layer = {messageId: overlayUuid(46), text: 'Fixture M2 message'};
    const record = recoveryRecordOf({layers: {message: layer}});
    expect(planRecovery(record, sources())).toMatchObject([
      {
        row: {kind: 'showing', counts: {messages: 1}},
        commands: [{type: 'message.show', message: layer}],
      },
    ]);
  });

  it('lists the rows in the order they are applied', () => {
    const record = recoveryRecordOf({
      outputs: {[MAIN]: true},
      stageMessage: 'Fixture stage note',
      layers: {slide: LIVE_SLIDE},
    });
    expect(planRecovery(record, sources()).map(({row}) => row.kind)).toEqual([
      'outputs',
      'slide',
      'showing',
    ]);
  });
});
