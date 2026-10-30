import {memo} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {
  lookIdSchema,
  mediaIdSchema,
  messageIdSchema,
  noticeSetIdSchema,
  propIdSchema,
  screenIdSchema,
  stageLayoutIdSchema,
  translationIdSchema,
  type LookId,
  type MediaId,
  type MessageId,
  type NoticeSetId,
  type PropId,
  type ScreenId,
  type StageLayoutId,
} from '@core/schema/ids';
import type {LooksFile} from '@core/schema/looks';
import type {PropsFile} from '@core/schema/props';
import type {NoticesFile} from '@core/schema/notices';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {
  MAIN_ID,
  CAPTIONS_ID,
  STAGE_ID,
  LOOK_ID,
  LAYOUT_ID,
  screensDocument,
  settingsDocument,
} from '@renderer/screens/testing/documents';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/showStore';
import {bibleSource} from '../bible/source';
import {MISSING_STILL_BACKGROUND_TIP} from '../problemReasons';
import {
  ShowingTab,
  ShowingRow,
  areShowingRowPropsEqual,
  type ShowingRowProps,
} from './ShowingTab';
import {computeShowingGroups, computeShowingCount} from './showingRows';
import {dismissMessage, dismissProp} from './showingDismiss';
import type {ShowingItem} from './showingTypes';

function parseTestMediaId(uuid: string): MediaId {
  return v.parse(mediaIdSchema, uuid);
}

function parseTestMessageId(uuid: string): MessageId {
  return v.parse(messageIdSchema, uuid);
}

function parseTestPropId(uuid: string): PropId {
  return v.parse(propIdSchema, uuid);
}

function parseTestNoticeId(uuid: string): NoticeSetId {
  return v.parse(noticeSetIdSchema, uuid);
}

function parseTestLookId(uuid: string): LookId {
  return v.parse(lookIdSchema, uuid);
}

function parseTestScreenId(uuid: string): ScreenId {
  return v.parse(screenIdSchema, uuid);
}

function parseTestStageLayoutId(uuid: string): StageLayoutId {
  return v.parse(stageLayoutIdSchema, uuid);
}

const UUID_MESSAGE = parseTestMessageId('11111111-2222-4333-8444-555555555555');
const UPPER_MESSAGE = '11111111-2222-4333-8444-55555555555A';
const LEGACY_MESSAGE = 'msg-legacy-id';
const UUID_PROP = parseTestPropId('66666666-7777-4888-8999-000000000000');
const UPPER_PROP = '66666666-7777-4888-8999-00000000000A';
const LEGACY_PROP = 'prop-legacy-id';
const NOTICE_ID = parseTestNoticeId('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
const MEDIA_ID = parseTestMediaId('00000000-0000-4000-8000-000000000055');
const IMAGE_MEDIA_ID = parseTestMediaId('00000000-0000-4000-8000-000000000088');
const MISSING_MEDIA_ID = parseTestMediaId(
  '99999999-9999-4999-8999-999999999999',
);

const testMainScreen = parseTestScreenId(MAIN_ID);
const testCaptionsScreen = parseTestScreenId(CAPTIONS_ID);
const testStageScreen = parseTestScreenId(STAGE_ID);

const stageLooks: LooksFile = {
  format: 'llsettings.looks',
  schemaVersion: 1,
  current: parseTestLookId('00000000-0000-4000-8000-0000000000a1'),
  looks: [
    {
      id: parseTestLookId('00000000-0000-4000-8000-0000000000a1'),
      name: '기본',
      screens: {
        [testMainScreen]: {
          layers: {
            slide: true,
            media: true,
            message: true,
            prop: true,
            notice: true,
          },
        },
        [testCaptionsScreen]: {
          layers: {
            slide: true,
            media: true,
            message: true,
            prop: true,
            notice: true,
          },
        },
        [testStageScreen]: {
          layers: {stageMessage: true, clock: true},
          stageLayout: parseTestStageLayoutId(LAYOUT_ID),
        },
      },
    },
  ],
  lyricStyles: [],
};

function clockStageDocument() {
  return settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    layouts: [
      {
        id: LAYOUT_ID,
        name: 'Clock',
        width: 1920,
        height: 1080,
        elements: [
          {
            id: 'clock',
            name: 'Clock',
            kind: 'clock',
            frame: {x: 0, y: 0, w: 100, h: 40},
          },
        ],
      },
    ],
  });
}

const testPropsFile: PropsFile = {
  format: 'llsettings.props',
  schemaVersion: 1,
  props: [
    {
      id: UUID_PROP,
      name: '로고',
      content: {kind: 'image', media: MEDIA_ID},
      targets: [testMainScreen],
    },
  ],
};

const testNoticesFile: NoticesFile = {
  format: 'llsettings.notices',
  schemaVersion: 1,
  sets: [
    {
      id: NOTICE_ID,
      name: '주일 광고',
      media: [MEDIA_ID],
      interval: 5,
      loop: true,
      targets: [testMainScreen],
    },
  ],
};

function testMediaDoc(): MediaDocument {
  return {
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: MEDIA_ID,
          name: '따뜻한 빛',
          kind: 'video',
          file: 'warm.mp4',
          size: 100,
          duration: 60,
        },
        {
          id: IMAGE_MEDIA_ID,
          name: '풍경 사진',
          kind: 'image',
          file: 'still.jpg',
          size: 50,
          duration: 0,
        },
      ],
      playlists: [],
      audioPlaylists: [],
    },
  };
}

function setupFixture() {
  const send = vi.fn();
  const getDoc = (name: string) => {
    if (name === 'screens') {
      return Promise.resolve(screensDocument());
    }
    if (name === 'looks') {
      return Promise.resolve(
        settingsDocument('looks', {
          current: LOOK_ID,
          looks: [
            {
              id: LOOK_ID,
              name: '기본',
              screens: {
                [MAIN_ID]: {
                  layers: {
                    slide: true,
                    media: true,
                    message: true,
                    prop: true,
                    notice: true,
                  },
                },
                [CAPTIONS_ID]: {
                  layers: {
                    slide: true,
                    media: true,
                    message: true,
                    prop: true,
                    notice: true,
                  },
                },
                [STAGE_ID]: {
                  layers: {stageMessage: true, clock: true},
                  stageLayout: LAYOUT_ID,
                },
              },
            },
          ],
          lyricStyles: [],
        }),
      );
    }
    if (name === 'stage-layouts') {
      return Promise.resolve(clockStageDocument());
    }
    if (name === 'props') {
      return Promise.resolve(
        settingsDocument('props', {
          props: [
            {
              id: UUID_PROP,
              name: '로고',
              content: {kind: 'image', media: MEDIA_ID},
              targets: [MAIN_ID],
            },
          ],
        }),
      );
    }
    if (name === 'notices') {
      return Promise.resolve(
        settingsDocument('notices', {
          sets: [
            {
              id: NOTICE_ID,
              name: '주일 광고',
              media: [MEDIA_ID],
              interval: 5,
              loop: true,
              targets: [MAIN_ID],
            },
          ],
        }),
      );
    }
    return Promise.reject(new Error(`Unknown doc: ${name}`));
  };

  window.llp = fakeLlpApi({
    settings: {
      get: vi.fn((req: {readonly name: string}) => getDoc(req.name)),
      subscribe: vi.fn(() => () => undefined),
    },
    live: {send},
    media: {
      get: vi.fn((): Promise<MediaDocument> => Promise.resolve(testMediaDoc())),
      subscribe: vi.fn(() => () => undefined),
      missing: vi.fn(() => Promise.resolve([MISSING_MEDIA_ID])),
      subscribeMissing: vi.fn(() => () => undefined),
    },
  });

  const setLive = (layers: object, extra: object = {}) => {
    const raw = {
      ...emptyLiveState(),
      ...extra,
      layers: {
        ...emptyLiveState().layers,
        ...layers,
      },
    };
    const parsed = parseLiveState(raw);
    if (!parsed.ok) {
      throw new Error(JSON.stringify(parsed.error));
    }
    useLive.setState({state: parsed.value});
  };

  return {send, setLive};
}

describe('ShowingTab', () => {
  let fixture: ReturnType<typeof setupFixture>;

  beforeEach(() => {
    fixture = setupFixture();
    useShow.setState({
      rows: [
        {
          id: 'song-1',
          kind: 'song',
          title: '만복의 근원 하나님',
        },
      ],
      openItemId: 'song-1',
    });
  });

  afterEach(() => {
    cleanup();
    delete window.llp;
  });

  it('validates UUID v4 schema and handles uppercase and legacy fallbacks', () => {
    expect(v.is(messageIdSchema, UUID_MESSAGE)).toBe(true);
    expect(v.is(propIdSchema, UUID_PROP)).toBe(true);
    expect(v.is(messageIdSchema, UPPER_MESSAGE)).toBe(false);
    expect(v.is(propIdSchema, UPPER_PROP)).toBe(false);
    expect(v.is(messageIdSchema, LEGACY_MESSAGE)).toBe(false);
    expect(v.is(propIdSchema, LEGACY_PROP)).toBe(false);

    fixture.setLive({
      message: {messageId: UPPER_MESSAGE, text: '대문자 메시지'},
    });
    dismissMessage(UPPER_MESSAGE);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'message',
    });

    fixture.send.mockClear();
    fixture.setLive({
      message: {
        messageId: UUID_MESSAGE,
        text: '첫째',
        items: [
          {
            messageId: UUID_MESSAGE,
            text: '첫째',
            targets: 'all',
            excludedTargets: [],
            startedAt: 1000,
            expiresAt: null,
          },
          {
            messageId: parseTestMessageId(
              '22222222-3333-4444-8555-666666666666',
            ),
            text: '둘째',
            targets: 'all',
            excludedTargets: [],
            startedAt: 1000,
            expiresAt: null,
          },
        ],
      },
    });
    dismissMessage(UPPER_MESSAGE);
    expect(fixture.send).not.toHaveBeenCalled();

    fixture.send.mockClear();
    fixture.setLive({
      prop: {propId: UPPER_PROP},
    });
    dismissProp(UPPER_PROP);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'prop',
    });
  });

  it('renders rows per kind with expected content, icons, and times', () => {
    const now = 1_700_000_050_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];

    const stageDoc = clockStageDocument();
    if (stageDoc.name !== 'stage-layouts') throw new Error('Expected layouts');
    const groups = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        stageMessage: '후렴 한 번 더',
        layers: {
          ...emptyLiveState().layers,
          slide: {
            itemId: 'song-1',
            position: 1,
            label: '후렴',
            lines: ['찬양하라'],
          },
          media: {
            mediaId: MEDIA_ID,
            loop: true,
            startedAt: now - 12_000,
          },
          message: {
            messageId: UUID_MESSAGE,
            text: '차량 이동',
            items: [
              {
                messageId: UUID_MESSAGE,
                text: '12가 3456 차량 이동 부탁드립니다',
                targets: 'all',
                excludedTargets: [],
                startedAt: now - 10_000,
                expiresAt: now + 42_000,
              },
            ],
          },
          prop: {
            propId: UUID_PROP,
            items: [
              {
                propId: UUID_PROP,
                content: {kind: 'image', media: MEDIA_ID},
                targets: [testMainScreen],
              },
            ],
          },
          notice: {
            noticeId: NOTICE_ID,
            playback: {
              media: [
                parseTestMediaId('00000000-0000-4000-8000-000000000001'),
                parseTestMediaId('00000000-0000-4000-8000-000000000002'),
                parseTestMediaId('00000000-0000-4000-8000-000000000003'),
                parseTestMediaId('00000000-0000-4000-8000-000000000004'),
                parseTestMediaId('00000000-0000-4000-8000-000000000005'),
                parseTestMediaId('00000000-0000-4000-8000-000000000006'),
              ],
              position: 2,
              interval: 5,
              loop: true,
              targets: [testMainScreen],
              startedAt: now,
              pausedAt: null,
            },
          },
        },
      },
      now,
      rows: [{id: 'song-1', kind: 'song', title: '만복의 근원 하나님'}],
      mediaItems: [
        {
          id: MEDIA_ID,
          name: '따뜻한 빛',
          kind: 'video',
          file: 'warm.mp4',
          size: 100,
          duration: 60,
        },
      ],
      propsFile: testPropsFile,
      noticesFile: testNoticesFile,
      stageLayoutsFile: stageDoc.value,
    });

    const [mainGroup, , stageGroup] = groups;
    if (mainGroup === undefined || stageGroup === undefined) {
      throw new Error('Expected groups');
    }

    expect(mainGroup.items.some(i => i.title.includes('만복의 근원'))).toBe(
      true,
    );
    expect(mainGroup.items.some(i => i.title === '따뜻한 빛')).toBe(true);
    expect(mainGroup.items.some(i => i.time === '0:12')).toBe(true);
    expect(mainGroup.items.some(i => i.title.includes('12가 3456'))).toBe(true);
    expect(mainGroup.items.some(i => i.time === '0:42')).toBe(true);
    expect(mainGroup.items.some(i => i.title === '로고')).toBe(true);
    expect(mainGroup.items.some(i => i.title.includes('주일 광고'))).toBe(true);

    expect(stageGroup.items.some(i => i.title === '후렴 한 번 더')).toBe(true);
    expect(stageGroup.items.some(i => i.kind === 'clock')).toBe(true);
  });

  it('counts a stage clock only when the active layout has a clock element', () => {
    const screensDoc = screensDocument();
    const clockDoc = clockStageDocument();
    const emptyDoc = settingsDocument('stage-layouts', {
      format: 'llsettings.stage',
      layouts: [
        {id: LAYOUT_ID, name: 'Empty', width: 1920, height: 1080, elements: []},
      ],
    });
    if (
      screensDoc.name !== 'screens' ||
      clockDoc.name !== 'stage-layouts' ||
      emptyDoc.name !== 'stage-layouts'
    ) {
      throw new Error('Invalid fixtures');
    }
    const options = {
      screens: screensDoc.value.screens,
      looks: stageLooks,
      liveState: emptyLiveState(),
      now: 1_700_000_000_000,
    };
    const withClock = {...options, stageLayoutsFile: clockDoc.value};
    const noClock = {...options, stageLayoutsFile: emptyDoc.value};
    expect(
      computeShowingGroups(withClock)
        .flatMap(group => group.items)
        .some(item => item.kind === 'clock'),
    ).toBe(true);
    expect(
      computeShowingGroups(noClock)
        .flatMap(group => group.items)
        .some(item => item.kind === 'clock'),
    ).toBe(false);
    expect(computeShowingCount(withClock)).toBe(
      computeShowingCount(noClock) + 1,
    );
    const missing = {
      ...withClock,
      liveState: {
        ...options.liveState,
        stageLayouts: {
          [testStageScreen]: parseTestStageLayoutId(
            '00000000-0000-4000-8000-0000000000b2',
          ),
        },
      },
    };
    expect(computeShowingCount(missing)).toBe(computeShowingCount(noClock));
    const emptyLayout = emptyDoc.value.layouts[0];
    if (!emptyLayout) throw new Error('Missing empty layout');
    const override = {
      ...missing,
      stageLayoutsFile: {
        ...clockDoc.value,
        layouts: [
          ...clockDoc.value.layouts,
          {
            ...emptyLayout,
            id: parseTestStageLayoutId('00000000-0000-4000-8000-0000000000b2'),
          },
        ],
      },
    };
    expect(computeShowingCount(override)).toBe(computeShowingCount(noClock));
  });

  it('names a live Bible verse by its book and verse', () => {
    const source = bibleSource({
      translation: v.parse(translationIdSchema, 'sample'),
      ref: '요한복음 3:16-19',
      displayRef: '요한복음 3:16-19',
      verses: [16, 17, 18, 19].map(verse => ({
        chapter: 3,
        verse,
        text: `Invented verse ${verse}`,
      })),
    });
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];
    const groups = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          slide: {
            itemId: source.id,
            position: 3,
            label: '3:19',
            lines: ['19 Invented verse 19'],
          },
        },
      },
      now: 5000,
      liveBibleSource: source,
    });
    const titles = groups
      .flatMap(group => group.items)
      .filter(item => item.kind === 'text')
      .map(item => item.title);
    expect(titles).not.toHaveLength(0);
    expect(new Set(titles)).toEqual(new Set(['요한복음 3:19']));
  });

  it('uses fallback title for unknown media and omits position time on image backgrounds', () => {
    const unknownMediaId = parseTestMediaId(
      '00000000-0000-4000-8000-000000000099',
    );
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];

    const groupsUnknown = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          media: {mediaId: unknownMediaId, loop: false, startedAt: 1000},
        },
      },
      now: 5000,
      mediaItems: [],
    });
    const mainUnknown = groupsUnknown[0];
    if (mainUnknown === undefined) {
      throw new Error('Expected group');
    }
    const unknownItem = mainUnknown.items.find(i => i.kind === 'media');
    expect(unknownItem?.title).toBe('배경');
    expect(unknownItem?.time).toBeUndefined();

    const groupsImage = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          media: {mediaId: IMAGE_MEDIA_ID, loop: false, startedAt: 1000},
        },
      },
      now: 15_000,
      mediaItems: [
        {
          id: IMAGE_MEDIA_ID,
          name: '풍경 사진',
          kind: 'image',
          file: 'still.jpg',
          size: 50,
          duration: 0,
        },
      ],
    });
    const mainImage = groupsImage[0];
    if (mainImage === undefined) {
      throw new Error('Expected group');
    }
    const imageItem = mainImage.items.find(i => i.kind === 'media');
    expect(imageItem?.title).toBe('풍경 사진');
    expect(imageItem?.time).toBeUndefined();
  });

  it('renders pause icon and tooltip only when the live media itself is missing', () => {
    const now = 1_700_000_000_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];

    const groupsWithMissingVideo = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          media: {mediaId: MISSING_MEDIA_ID, loop: true, startedAt: now},
        },
      },
      now,
      missingMediaIds: new Set([MISSING_MEDIA_ID]),
      mediaItems: [
        {
          id: MISSING_MEDIA_ID,
          name: '부활절 영상',
          kind: 'video',
          file: 'missing.mp4',
          size: 100,
          duration: 10,
        },
      ],
      rows: [
        {
          id: 'song-1',
          kind: 'song',
          title: '곡',
          problem: 'missing-background',
        },
      ],
    });
    const itemMissing = groupsWithMissingVideo[0]?.items.find(
      i => i.kind === 'media',
    );
    expect(itemMissing?.icon).toBe('pause');
    expect(itemMissing?.iconTooltip).toBe(MISSING_STILL_BACKGROUND_TIP);

    const groupsWithOtherMissing = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          media: {mediaId: MEDIA_ID, loop: true, startedAt: now},
        },
      },
      now,
      missingMediaIds: new Set([MISSING_MEDIA_ID]),
      mediaItems: [
        {
          id: MEDIA_ID,
          name: '따뜻한 빛',
          kind: 'video',
          file: 'warm.mp4',
          size: 100,
          duration: 60,
        },
      ],
      rows: [
        {
          id: 'song-1',
          kind: 'song',
          title: '곡',
          problem: 'missing-background',
        },
      ],
    });
    const itemNotMissing = groupsWithOtherMissing[0]?.items.find(
      i => i.kind === 'media',
    );
    expect(itemNotMissing?.icon).toBe('image');
    expect(itemNotMissing?.iconTooltip).toBeUndefined();
  });

  it('omits expired messages and excluded screen targets', () => {
    const now = 1_700_000_000_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];

    const groups = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          message: {
            messageId: UUID_MESSAGE,
            text: '메시지',
            items: [
              {
                messageId: UUID_MESSAGE,
                text: '자막에만 표시',
                targets: 'all',
                excludedTargets: [testMainScreen],
                startedAt: now - 5000,
                expiresAt: now + 30_000,
              },
              {
                messageId: parseTestMessageId(
                  '33333333-4444-4555-8666-777777777777',
                ),
                text: '이미 만료된 메시지',
                targets: 'all',
                excludedTargets: [],
                startedAt: now - 20_000,
                expiresAt: now - 1000,
              },
            ],
          },
        },
      },
      now,
    });

    const mainGroup = groups.find(g => g.screenId === testMainScreen);
    const captionsGroup = groups.find(g => g.screenId === testCaptionsScreen);

    expect(mainGroup).toBeUndefined();
    expect(captionsGroup?.items.some(i => i.title === '자막에만 표시')).toBe(
      true,
    );
    expect(captionsGroup?.items.some(i => i.title.includes('만료된'))).toBe(
      false,
    );
  });

  it('updates timed message and removes it on expiration with fake timers', async () => {
    vi.useFakeTimers();
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);

    fixture.setLive({
      message: {
        messageId: UUID_MESSAGE,
        text: '5초 후 종료',
        items: [
          {
            messageId: UUID_MESSAGE,
            text: '5초 후 종료',
            targets: [MAIN_ID],
            excludedTargets: [],
            startedAt: now,
            expiresAt: now + 5000,
          },
        ],
      },
    });

    render(<ShowingTab />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('5초 후 종료')).toBeDefined();
    expect(screen.getByText('0:05')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('0:03')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('5초 후 종료')).toBeNull();

    vi.useRealTimers();
  });

  it('ticks video time once per second (1 s interval) rather than 4 Hz', async () => {
    vi.useFakeTimers();
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);

    fixture.setLive({
      media: {mediaId: MEDIA_ID, loop: true, startedAt: now},
    });

    render(<ShowingTab />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getAllByText('0:00')).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getAllByText('0:00')).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getAllByText('0:01')).toHaveLength(2);

    vi.useRealTimers();
  });

  it('toggles clear for slide and media with clearToggles active', async () => {
    fixture.setLive(
      {
        slide: {itemId: 'song-1', position: 0, label: null, lines: []},
        media: {mediaId: MEDIA_ID, loop: true, startedAt: 1000},
      },
      {clearToggles: ['slide', 'media']},
    );

    render(<ShowingTab />);
    await act(async () => {
      await Promise.resolve();
    });

    const buttons = screen.getAllByRole('button', {name: '내리기'});
    const [slideBtn, mediaBtn] = buttons;
    if (slideBtn === undefined || mediaBtn === undefined) {
      throw new Error('Expected buttons');
    }

    fireEvent.click(slideBtn);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'slide',
    });

    fixture.send.mockClear();
    fireEvent.click(mediaBtn);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'media',
    });
  });

  it('executes individual overlay clear for message, prop, and stage message', async () => {
    fixture.setLive(
      {
        message: {
          messageId: UUID_MESSAGE,
          text: '알림',
          items: [
            {
              messageId: UUID_MESSAGE,
              text: '알림 메시지',
              targets: [MAIN_ID],
              excludedTargets: [],
              startedAt: 1000,
              expiresAt: null,
            },
          ],
        },
        prop: {
          propId: UUID_PROP,
          items: [
            {
              propId: UUID_PROP,
              content: {kind: 'image', media: MEDIA_ID},
              targets: [MAIN_ID],
            },
          ],
        },
      },
      {stageMessage: '무대 전달 사항'},
    );

    render(<ShowingTab />);
    await act(async () => {
      await Promise.resolve();
    });

    const messageBtn = screen
      .getByText('알림 메시지')
      .closest('div')
      ?.querySelector('button');
    if (!messageBtn) {
      throw new Error('Expected message button');
    }
    fireEvent.click(messageBtn);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'overlay.clear',
      target: {kind: 'message', messageId: UUID_MESSAGE},
    });

    fixture.send.mockClear();
    const propBtn = screen
      .getByText('로고')
      .closest('div')
      ?.querySelector('button');
    if (!propBtn) {
      throw new Error('Expected prop button');
    }
    fireEvent.click(propBtn);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'overlay.clear',
      target: {kind: 'prop', propId: UUID_PROP},
    });

    fixture.send.mockClear();
    const stageMsgBtn = screen
      .getByText('무대 전달 사항')
      .closest('div')
      ?.querySelector('button');
    if (!stageMsgBtn) {
      throw new Error('Expected stageMsg button');
    }
    fireEvent.click(stageMsgBtn);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'overlay.clear',
      target: {kind: 'stage-message'},
    });
  });

  it('does not render 내리기 on clock row and leaves undo preserved on dismiss', async () => {
    fixture.setLive({}, {canUndo: true});
    render(<ShowingTab />);
    await act(async () => {
      await Promise.resolve();
    });

    const clockText = screen.getByText('시계');
    const clockRowElement = clockText.closest('div');
    if (clockRowElement === null) {
      throw new Error('Expected clock row');
    }
    expect(
      within(clockRowElement).queryByRole('button', {name: '내리기'}),
    ).toBeNull();
  });

  it('proves computeShowingCount equals total rows across all screens on a fixture with every kind', () => {
    const screensDoc = screensDocument();
    if (screensDoc.value.format !== 'llsettings.screens') {
      throw new Error('expected screens document');
    }
    const screens = screensDoc.value.screens;
    const stageDoc = clockStageDocument();
    if (stageDoc.value.format !== 'llsettings.stage') {
      throw new Error('expected stage layouts document');
    }
    const now = 1_700_000_000_000;
    const allKindsLooks: LooksFile = {
      format: 'llsettings.looks',
      schemaVersion: 1,
      current: parseTestLookId(LOOK_ID),
      looks: [
        {
          id: parseTestLookId(LOOK_ID),
          name: '모든 레이어',
          screens: {
            [testMainScreen]: {
              layers: {
                slide: true,
                media: true,
                message: true,
                prop: true,
                notice: true,
              },
            },
            [testCaptionsScreen]: {
              layers: {
                slide: true,
                media: true,
                message: true,
                prop: true,
                notice: true,
              },
            },
            [testStageScreen]: {
              layers: {stageMessage: true, clock: true},
              stageLayout: parseTestStageLayoutId(LAYOUT_ID),
            },
          },
        },
      ],
      lyricStyles: [],
    };

    const options = {
      screens,
      looks: allKindsLooks,
      liveState: {
        ...emptyLiveState(),
        version: 1,
        lookId: parseTestLookId(LOOK_ID),
        stageMessage: '무대 전달 사항',
        layers: {
          slide: {
            itemId: 'song-1',
            position: 0,
            label: '1절',
            lines: ['가사 첫줄'],
          },
          media: {
            mediaId: MEDIA_ID,
            loop: true,
            startedAt: now,
          },
          message: {
            messageId: UUID_MESSAGE,
            text: '알림',
            items: [
              {
                messageId: UUID_MESSAGE,
                text: '자막 알림',
                targets: [testMainScreen],
                excludedTargets: [],
                startedAt: now,
                expiresAt: null,
              },
            ],
          },
          prop: {
            propId: UUID_PROP,
            items: [
              {
                propId: UUID_PROP,
                content: {kind: 'image' as const, media: MEDIA_ID},
                targets: [testMainScreen],
              },
            ],
          },
          notice: {
            noticeId: NOTICE_ID,
            playback: {
              media: [MEDIA_ID],
              position: 0,
              interval: 5,
              loop: true,
              targets: [testMainScreen],
              startedAt: now,
              pausedAt: null,
            },
          },
          audio: null,
        },
      },
      now,
      rows: [{id: 'song-1', kind: 'song' as const, title: '찬양'}],
      mediaItems: [
        {
          id: MEDIA_ID,
          name: '배경 영상',
          kind: 'video' as const,
          file: 'bg.mp4',
          size: 100,
          duration: 30,
        },
      ],
      propsFile: testPropsFile,
      noticesFile: testNoticesFile,
      stageLayoutsFile: stageDoc.value,
    };

    const groups = computeShowingGroups(options);
    const count = computeShowingCount(options);
    const totalRows = groups.reduce((acc, g) => acc + g.items.length, 0);

    expect(count).toBe(totalRows);

    const allKinds = new Set(groups.flatMap(g => g.items.map(i => i.kind)));
    expect(allKinds).toEqual(
      new Set(['text', 'media', 'msg', 'prop', 'notice', 'stagemsg', 'clock']),
    );
  });

  it('proves an unchanged row does not re-render when only another row time changes', () => {
    const onDismiss = vi.fn();
    const item1: ShowingItem = {
      id: 'main-slide',
      kind: 'text',
      kindLabel: '가사',
      icon: 'text',
      title: '만복의 근원',
      dismiss: {kind: 'slide'},
    };
    const item2Initial: ShowingItem = {
      id: 'main-msg',
      kind: 'msg',
      kindLabel: '메시지',
      icon: 'msg',
      title: '차량 이동',
      time: '0:42',
      dismiss: {kind: 'message', messageId: UUID_MESSAGE},
    };
    const item2Updated: ShowingItem = {
      ...item2Initial,
      time: '0:41',
    };

    let row1Renders = 0;
    let row2Renders = 0;
    const SpiedRow1 = memo((props: ShowingRowProps) => {
      row1Renders++;
      return <ShowingRow {...props} />;
    }, areShowingRowPropsEqual);
    const SpiedRow2 = memo((props: ShowingRowProps) => {
      row2Renders++;
      return <ShowingRow {...props} />;
    }, areShowingRowPropsEqual);

    const {rerender} = render(
      <div>
        <SpiedRow1 item={item1} onDismiss={onDismiss} />
        <SpiedRow2 item={item2Initial} onDismiss={onDismiss} />
      </div>,
    );
    expect(row1Renders).toBe(1);
    expect(row2Renders).toBe(1);

    const item1Clone: ShowingItem = {
      id: 'main-slide',
      kind: 'text',
      kindLabel: '가사',
      icon: 'text',
      title: '만복의 근원',
      dismiss: {kind: 'slide'},
    };
    rerender(
      <div>
        <SpiedRow1 item={item1Clone} onDismiss={onDismiss} />
        <SpiedRow2 item={item2Updated} onDismiss={onDismiss} />
      </div>,
    );

    expect(row1Renders).toBe(1);
    expect(row2Renders).toBe(2);
  });

  it('clamps video time when shorter than 1 s and when non-looping video exceeds duration', () => {
    const screensDoc = screensDocument();
    if (screensDoc.value.format !== 'llsettings.screens') {
      throw new Error('expected screens document');
    }
    const screens = screensDoc.value.screens;
    const now = 1_700_000_000_000;
    const shortVideoId = parseTestMediaId(
      '00000000-0000-4000-8000-000000000088',
    );
    const tenSecVideoId = parseTestMediaId(
      '00000000-0000-4000-8000-000000000089',
    );

    const groupsShort = computeShowingGroups({
      screens,
      looks: null,
      liveState: {
        ...emptyLiveState(),
        version: 1,
        layers: {
          ...emptyLiveState().layers,
          media: {
            mediaId: shortVideoId,
            loop: true,
            startedAt: now - 3000,
          },
        },
      },
      now,
      mediaItems: [
        {
          id: shortVideoId,
          name: '짧은 클립',
          kind: 'video',
          file: 'short.mp4',
          size: 10,
          duration: 0.4,
        },
      ],
    });
    const shortRow = groupsShort[0]?.items.find(i => i.kind === 'media');
    expect(shortRow?.time).toBe('0:00');
    expect(shortRow?.time).not.toContain('NaN');

    const groupsOver = computeShowingGroups({
      screens,
      looks: null,
      liveState: {
        ...emptyLiveState(),
        version: 1,
        layers: {
          ...emptyLiveState().layers,
          media: {
            mediaId: tenSecVideoId,
            loop: false,
            startedAt: now - 25000,
          },
        },
      },
      now,
      mediaItems: [
        {
          id: tenSecVideoId,
          name: '10초 영상',
          kind: 'video',
          file: 'ten.mp4',
          size: 100,
          duration: 10,
        },
      ],
    });
    const overRow = groupsOver[0]?.items.find(i => i.kind === 'media');
    expect(overRow?.time).toBe('0:10');
  });
});
