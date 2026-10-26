import {describe, expect, it, vi} from 'vitest';
import {emptyLiveState, type LiveState} from '@shared/live';
import {parseLookId} from '@shared/schema/ids';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {
  CAPTIONS,
  MAIN,
  overlaySettings,
  overlayUuid,
  settingsDocument,
  STAGE,
  TEXT_STYLE,
} from '../../../main/live/testing/overlays';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {MAX_REPORTED_LOOK_GAPS, ScreenFrames} from './screenFrames';
import type {LookGap} from './screenLook';

const NORMAL = lookIdOf(80);
const VIDEO_ONLY = lookIdOf(81);
const GREEN = '#00B140';

function lookIdOf(id: number) {
  const parsed = parseLookId(overlayUuid(id));
  if (!parsed.ok) throw new Error('Invalid Look fixture id');
  return parsed.value;
}

function looksDocument(revision = 1, extraLooks: readonly object[] = []) {
  return settingsDocument(
    'looks',
    {
      current: NORMAL,
      looks: [
        {
          id: NORMAL,
          name: '평상시',
          screens: {
            [MAIN]: {layers: {media: true, slide: true}},
            [CAPTIONS]: {
              layers: {slide: true},
              background: {kind: 'color', color: GREEN},
            },
            [STAGE]: {layers: {slide: true, stageMessage: true}},
          },
        },
        {
          id: VIDEO_ONLY,
          name: '영상만',
          screens: {
            [MAIN]: {layers: {media: true}},
            [CAPTIONS]: {layers: {}},
            [STAGE]: {layers: {}},
          },
        },
        ...extraLooks,
      ],
      lyricStyles: [],
    },
    revision,
  );
}

function fakeSettings(looks: SettingsDocument = looksDocument()) {
  const listeners = new Set<(document: SettingsDocument) => void>();
  const unsubscribe = vi.fn();
  const screens = overlaySettings().reader.get('screens');
  return {
    unsubscribe,
    push: (document: SettingsDocument) => {
      for (const listener of listeners) listener(document);
    },
    api: {
      get: ({name}: {readonly name: string}) =>
        Promise.resolve(name === 'looks' ? looks : screens),
      edit: vi.fn(),
      subscribe: (listener: (document: SettingsDocument) => void) => {
        listeners.add(listener);
        return unsubscribe;
      },
    },
  };
}

async function framesFor(
  screenId: string,
  settings = fakeSettings(),
  onGap = vi.fn<(message: string, gap: LookGap) => void>(),
) {
  const onChange = vi.fn();
  const frames = new ScreenFrames({
    settings: settings.api,
    screenId,
    onChange,
    onError: vi.fn(),
    onGap,
  });
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  return {frames, onChange, onGap, settings};
}

function stateWith(fields: Partial<LiveState>): LiveState {
  return {...emptyLiveState(), ...fields};
}

describe('ScreenFrames', () => {
  it('has no frame until the screen is known', () => {
    const settings = fakeSettings();
    const frames = new ScreenFrames({
      settings: settings.api,
      screenId: MAIN,
      onChange: vi.fn(),
      onError: vi.fn(),
      onGap: vi.fn(),
    });
    expect(frames.frame(emptyLiveState())).toBeUndefined();
    frames.dispose();
  });

  it('draws the screen with its stage message and its card of the live Look', async () => {
    const {frames} = await framesFor(STAGE);
    expect(frames.frame(stateWith({stageMessage: 'Fixture note'}))).toEqual({
      screen: {id: STAGE, kind: 'stage', method: 'fullscreen'},
      stageMessage: 'Fixture note',
      look: {
        layers: {slide: true, stageMessage: true},
        lyricStyle: DEFAULT_LYRIC_STYLE,
        background: null,
      },
    });
    frames.dispose();
  });

  it('changes every screen at once from one live state', async () => {
    const settings = fakeSettings();
    const screens = await Promise.all(
      [MAIN, CAPTIONS, STAGE].map(id => framesFor(id, settings)),
    );
    const switched = stateWith({lookId: VIDEO_ONLY});
    expect(
      screens.map(({frames}) => frames.frame(switched)?.look?.layers),
    ).toEqual([{media: true}, {}, {}]);
    for (const {frames} of screens) frames.dispose();
  });

  it('resolves the Look again only when the Looks, the live Look, or the screen change', async () => {
    const {frames, onChange, settings} = await framesFor(CAPTIONS);
    const first = frames.frame(stateWith({version: 1}))?.look;
    expect(frames.frame(stateWith({version: 2}))?.look).toBe(first);
    expect(frames.frame(stateWith({lookId: VIDEO_ONLY}))?.look).not.toBe(first);
    const normal = frames.frame(stateWith({lookId: NORMAL}))?.look;
    settings.push(looksDocument(2));
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(frames.frame(stateWith({lookId: NORMAL}))?.look).not.toBe(normal);
    expect(frames.frame(stateWith({lookId: NORMAL}))?.look).toEqual(normal);
    frames.dispose();
  });

  it('logs each gap once per screen and id, up to a cap, until the Looks change', async () => {
    const broken = Array.from({length: MAX_REPORTED_LOOK_GAPS + 8}, (_, i) => ({
      id: lookIdOf(100 + i),
      name: `Broken ${i}`,
      screens: {[MAIN]: {layers: {}, lyricStyle: overlayUuid(300 + i)}},
    }));
    const settings = fakeSettings(looksDocument(1, broken));
    const {frames, onGap} = await framesFor(MAIN, settings);
    const drawAll = () => {
      for (const {id} of broken) frames.frame(stateWith({lookId: id}));
    };
    drawAll();
    drawAll();
    expect(onGap).toHaveBeenCalledTimes(MAX_REPORTED_LOOK_GAPS);
    expect(onGap.mock.calls[0]).toEqual([
      expect.stringContaining('lyric style'),
      {kind: 'missing-style', id: overlayUuid(300)},
    ]);
    settings.push(looksDocument(2, broken));
    drawAll();
    expect(onGap).toHaveBeenCalledTimes(MAX_REPORTED_LOOK_GAPS * 2);
    frames.dispose();
  });

  it('logs a gap once while the screen keeps drawing it', async () => {
    const broken = [0, 1].map(i => ({
      id: lookIdOf(200 + i),
      name: `Broken ${i}`,
      screens: {},
    }));
    const settings = fakeSettings(looksDocument(1, broken));
    const {frames, onGap} = await framesFor(MAIN, settings);
    for (let round = 0; round < 3; round++) {
      for (const {id} of broken) frames.frame(stateWith({lookId: id}));
    }
    expect(onGap.mock.calls.map(([, gap]) => gap)).toEqual(
      broken.map(({id}) => ({kind: 'no-card', id})),
    );
    frames.dispose();
  });

  it('drops the lyric style of a screen that becomes a 무대 화면', async () => {
    const lowerThird = overlayUuid(210);
    const styled = settingsDocument('looks', {
      current: NORMAL,
      looks: [
        {
          id: NORMAL,
          name: '평상시',
          screens: {
            [CAPTIONS]: {layers: {slide: true}, lyricStyle: lowerThird},
          },
        },
      ],
      lyricStyles: [
        {...TEXT_STYLE, id: lowerThird, name: '하단 자막', vAlign: 'bottom'},
      ],
    });
    const settings = fakeSettings(styled);
    const {frames} = await framesFor(CAPTIONS, settings);
    const state = stateWith({});
    expect(frames.frame(state)?.look?.lyricStyle.vAlign).toBe('bottom');
    const screens = overlaySettings().reader.get('screens');
    if (screens.name !== 'screens') throw new Error('Missing screens');
    settings.push(
      settingsDocument(
        'screens',
        {
          screens: screens.value.screens.map(screen =>
            screen.id === CAPTIONS ? {...screen, kind: 'stage'} : screen,
          ),
        },
        2,
      ),
    );
    expect(frames.frame(state)?.look?.lyricStyle).toEqual(DEFAULT_LYRIC_STYLE);
    frames.dispose();
  });

  it('stops following both documents on dispose', async () => {
    const {frames, settings} = await framesFor(MAIN);
    frames.dispose();
    expect(settings.unsubscribe).toHaveBeenCalledTimes(2);
  });
});
