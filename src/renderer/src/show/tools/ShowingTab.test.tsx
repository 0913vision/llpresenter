import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {emptyLiveState} from '@shared/live';
import {parseLiveState} from '@shared/schema/liveState';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {
  lookIdSchema,
  mediaIdSchema,
  messageIdSchema,
  noticeSetIdSchema,
  propIdSchema,
  screenIdSchema,
  type LookId,
  type MediaId,
  type MessageId,
  type NoticeSetId,
  type PropId,
  type ScreenId,
} from '@shared/schema/ids';
import type {LooksFile} from '@shared/schema/looks';
import type {PropsFile} from '@shared/schema/props';
import type {NoticesFile} from '@shared/schema/notices';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import {
  MAIN_ID,
  CAPTIONS_ID,
  STAGE_ID,
  screensDocument,
  looksDocument,
  stageLayoutsDocument,
  settingsDocument,
} from '@renderer/screens/testing/documents';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/showStore';
import {Panel, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import {MISSING_STILL_BACKGROUND_TIP} from '../problemReasons';
import {ShowingTab} from './ShowingTab';
import {
  computeShowingGroups,
  dismissMedia,
  dismissMessage,
  dismissNotice,
  dismissProp,
  dismissSlide,
  dismissStageMessage,
  isUuidV4,
  useShowingCountStore,
} from './showingRows';

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

const UUID_MESSAGE = parseTestMessageId('11111111-2222-4333-8444-555555555555');
const LEGACY_MESSAGE = 'msg-legacy-id';
const UUID_PROP = parseTestPropId('66666666-7777-4888-8999-000000000000');
const LEGACY_PROP = 'prop-legacy-id';
const NOTICE_ID = parseTestNoticeId('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
const MEDIA_ID = parseTestMediaId('00000000-0000-4000-8000-000000000055');
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
        [testStageScreen]: {layers: {stageMessage: true, clock: true}},
      },
    },
  ],
  lyricStyles: [],
};

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

function setupFixture() {
  const send = vi.fn();
  const getDoc = (name: string) => {
    if (name === 'screens') {
      return Promise.resolve(screensDocument());
    }
    if (name === 'looks') {
      return Promise.resolve(looksDocument());
    }
    if (name === 'stage-layouts') {
      return Promise.resolve(stageLayoutsDocument());
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
      get: vi.fn((): Promise<MediaDocument> =>
        Promise.resolve({
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
            ],
            playlists: [],
            audioPlaylists: [],
          },
        }),
      ),
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

  it('validates lowercase UUID v4 strings properly', () => {
    expect(isUuidV4(UUID_MESSAGE)).toBe(true);
    expect(isUuidV4(UUID_PROP)).toBe(true);
    expect(isUuidV4(LEGACY_MESSAGE)).toBe(false);
    expect(isUuidV4(LEGACY_PROP)).toBe(false);
  });

  it('renders rows per kind with expected content, icons, and times', () => {
    const now = 1_700_000_050_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];

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
      rows: [
        {
          id: 'song-1',
          kind: 'song',
          title: '만복의 근원 하나님',
        },
      ],
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
    });

    render(<ShowingTab groups={groups} />);

    const mainHeader = screen.getByText('본 화면');
    const mainGroup = mainHeader.closest('div');
    if (mainGroup === null) {
      throw new Error('Expected mainGroup');
    }
    expect(
      within(mainGroup).getByText('만복의 근원 하나님 후렴'),
    ).toBeDefined();
    expect(within(mainGroup).getByText('따뜻한 빛')).toBeDefined();
    expect(within(mainGroup).getByText('0:12')).toBeDefined();
    expect(
      within(mainGroup).getByText('12가 3456 차량 이동 부탁드립니다'),
    ).toBeDefined();
    expect(within(mainGroup).getByText('0:42')).toBeDefined();
    expect(within(mainGroup).getByText('로고')).toBeDefined();
    expect(within(mainGroup).getByText('주일 광고 3 / 6')).toBeDefined();

    const stageHeader = screen.getByText('무대 화면');
    const stageGroup = stageHeader.closest('div');
    if (stageGroup === null) {
      throw new Error('Expected stageGroup');
    }
    expect(within(stageGroup).getByText('후렴 한 번 더')).toBeDefined();
    expect(within(stageGroup).getByText('시계')).toBeDefined();
  });

  it('groups items by screen and excludes lyrics from the stage screen', () => {
    const now = 1_700_000_000_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];

    const groups = computeShowingGroups({
      screens,
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        stageMessage: '마무리',
        layers: {
          ...emptyLiveState().layers,
          slide: {
            itemId: 'song-1',
            position: 0,
            label: null,
            lines: [],
          },
        },
      },
      now,
      rows: [{id: 'song-1', kind: 'song', title: '찬양'}],
    });

    render(<ShowingTab groups={groups} />);

    expect(screen.getByText('본 화면')).toBeDefined();
    expect(screen.getByText('방송 자막')).toBeDefined();
    expect(screen.getByText('무대 화면')).toBeDefined();

    const stageHeader = screen.getByText('무대 화면');
    const stageGroup = stageHeader.closest('div');
    if (stageGroup === null) {
      throw new Error('Expected stageGroup');
    }
    expect(within(stageGroup).queryByText('가사')).toBeNull();
    expect(within(stageGroup).getByText('무대')).toBeDefined();
    expect(within(stageGroup).getByText('시계')).toBeDefined();
  });

  it('hides count badge at 0 and displays it when count > 0', () => {
    useShowingCountStore.setState({count: 0});
    const {rerender} = render(
      <Panel label="진행 도구">
        <PanelHeader>
          <PanelTabs
            tabs={[{value: 'showing', label: '표시 중', count: 0}]}
            value="showing"
            onChange={() => undefined}
          />
        </PanelHeader>
      </Panel>,
    );

    const tab = screen.getByRole('tab');
    expect(tab.textContent).toBe('표시 중');
    expect(tab.getAttribute('aria-label')).toBeNull();

    rerender(
      <Panel label="진행 도구">
        <PanelHeader>
          <PanelTabs
            tabs={[{value: 'showing', label: '표시 중', count: 5}]}
            value="showing"
            onChange={() => undefined}
          />
        </PanelHeader>
      </Panel>,
    );

    const updatedTab = screen.getByRole('tab');
    expect(updatedTab.textContent).toContain('5');
    expect(updatedTab.getAttribute('aria-label')).toBe('표시 중 5개');
  });

  it('renders pause icon with tooltip when background media is missing', () => {
    const now = 1_700_000_000_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];
    const mainScreen = screens[0];
    if (mainScreen === undefined) {
      throw new Error('Expected mainScreen');
    }

    const groups = computeShowingGroups({
      screens: [mainScreen],
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          media: {
            mediaId: MISSING_MEDIA_ID,
            loop: true,
            startedAt: now,
          },
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
        },
      ],
    });

    render(<ShowingTab groups={groups} />);

    const pauseIcon = screen.getByRole('img', {
      name: MISSING_STILL_BACKGROUND_TIP,
    });
    expect(pauseIcon).toBeDefined();
  });

  it('sends the correct commands for each 내리기 button press', async () => {
    const onDismissSlide = vi.fn();
    const onDismissMedia = vi.fn();
    const onDismissMessage = vi.fn();
    const onDismissProp = vi.fn();
    const onDismissNotice = vi.fn();
    const onDismissStageMessage = vi.fn();

    const now = 1_700_000_000_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];
    const mainScreen = screens[0];
    if (mainScreen === undefined) {
      throw new Error('Expected mainScreen');
    }

    const groups = computeShowingGroups({
      screens: [mainScreen],
      looks: stageLooks,
      liveState: {
        ...emptyLiveState(),
        layers: {
          ...emptyLiveState().layers,
          slide: {itemId: 'song-1', position: 0, label: null, lines: []},
          media: {mediaId: MEDIA_ID, loop: true, startedAt: now},
          message: {
            messageId: UUID_MESSAGE,
            text: '차량',
            items: [
              {
                messageId: UUID_MESSAGE,
                text: '차량 이동',
                targets: 'all',
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
                content: {kind: 'image', media: MEDIA_ID},
                targets: [testMainScreen],
              },
            ],
          },
          notice: {
            noticeId: NOTICE_ID,
            playback: {
              media: [parseTestMediaId('00000000-0000-4000-8000-000000000001')],
              position: 0,
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
      handlers: {
        onDismissSlide,
        onDismissMedia,
        onDismissMessage,
        onDismissProp,
        onDismissNotice,
        onDismissStageMessage,
      },
    });

    render(<ShowingTab groups={groups} />);

    const buttons = screen.getAllByRole('button', {name: '내리기'});
    expect(buttons).toHaveLength(5);

    const [btn1, btn2, btn3, btn4, btn5] = buttons;
    if (
      btn1 === undefined ||
      btn2 === undefined ||
      btn3 === undefined ||
      btn4 === undefined ||
      btn5 === undefined
    ) {
      throw new Error('Expected 5 buttons');
    }

    await userEvent.click(btn1);
    expect(onDismissSlide).toHaveBeenCalledTimes(1);

    await userEvent.click(btn2);
    expect(onDismissMedia).toHaveBeenCalledTimes(1);

    await userEvent.click(btn3);
    expect(onDismissMessage).toHaveBeenCalledWith(UUID_MESSAGE);

    await userEvent.click(btn4);
    expect(onDismissProp).toHaveBeenCalledWith(UUID_PROP);

    await userEvent.click(btn5);
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
  });

  it('sends default live commands through command sink for each dismiss action', () => {
    fixture.setLive({
      slide: {itemId: 'song-1', position: 0, label: null, lines: []},
      media: {mediaId: MEDIA_ID, loop: true, startedAt: 1000},
    });

    dismissSlide();
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'slide',
    });

    dismissMedia();
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'media',
    });

    dismissMessage(UUID_MESSAGE);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'overlay.clear',
      target: {kind: 'message', messageId: UUID_MESSAGE},
    });

    fixture.setLive({message: {messageId: LEGACY_MESSAGE, text: 'old'}});
    dismissMessage(LEGACY_MESSAGE);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'message',
    });

    dismissProp(UUID_PROP);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'overlay.clear',
      target: {kind: 'prop', propId: UUID_PROP},
    });

    fixture.setLive({prop: {propId: LEGACY_PROP}});
    dismissProp(LEGACY_PROP);
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'prop',
    });

    fixture.setLive({notice: {noticeId: NOTICE_ID}});
    dismissNotice();
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'layer.clear.toggle',
      target: 'notice',
    });

    dismissStageMessage();
    expect(fixture.send).toHaveBeenCalledWith({
      type: 'overlay.clear',
      target: {kind: 'stage-message'},
    });
  });

  it('does not render a 내리기 button on the clock row', () => {
    const now = 1_700_000_000_000;
    const screensDoc = screensDocument();
    const screens =
      screensDoc.name === 'screens' ? screensDoc.value.screens : [];
    const stageScreen = screens[2];
    if (stageScreen === undefined) {
      throw new Error('Expected stageScreen');
    }

    const groups = computeShowingGroups({
      screens: [stageScreen],
      looks: stageLooks,
      liveState: emptyLiveState(),
      now,
    });

    render(<ShowingTab groups={groups} />);

    expect(screen.getByText('시계')).toBeDefined();
    const clockRowElement = screen.getByText('시계').closest('div');
    if (clockRowElement === null) {
      throw new Error('Expected clockRowElement');
    }
    expect(
      within(clockRowElement).queryByRole('button', {name: '내리기'}),
    ).toBeNull();
  });
});
