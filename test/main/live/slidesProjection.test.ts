import {afterEach, expect, it, vi} from 'vitest';
import {registerSlidesProjection} from '@main/live/slidesProjection';
import {serviceEndpoints} from '@contracts/ipc/service';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {createServiceItemId} from '@core/schema/ids';
import {renderedVerseSlides, slidesBibleItem} from '@fixtures/core/slidesBible';
import {SUNDAY_ID} from '@fixtures/main/store/testFiles';
import {overlaySettings} from '@fixtures/core/overlays';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeFile} from '@fixtures/core/themeOutput';
import {LiveStore} from '@main/live/store';
import {followSlideAdvance} from '@main/live/slideAdvance';
import {slideLayerOf} from '@core/presentation/slideLayer';

const ipc = vi.hoisted(() => {
  type Listener = (event: unknown, value: unknown) => void;
  return {
    on: vi.fn<(channel: string, listener: Listener) => void>(),
    removeListener: vi.fn<(channel: string, listener: Listener) => void>(),
  };
});
vi.mock('electron', () => ({ipcMain: ipc}));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
const mockLog = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  flush: async () => undefined,
});

function fixture() {
  const item = slidesBibleItem();
  const parsed = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SUNDAY_ID,
      name: 'Invented',
      date: '2026-11-06T11:00',
      order: [item],
    },
    revision: 1,
    access: 'editable',
  });
  if (!parsed.ok || parsed.value === null) {
    throw Error('Missing document fixture');
  }
  const document = parsed.value;
  const content = {
    openServiceId: document.service.id,
    service: (id: string) => (id === document.service.id ? document : null),
  };
  const output = renderedVerseSlides();
  const settings = overlaySettings();
  settings.update(settingsDocument('themes', themeFile()));
  settings.update(settingsDocument('bibleCuts', {entries: {}}));
  const value = {
    serviceId: document.service.id,
    itemId: item.id,
    revision: 1,
    measurement: {themes: 1, screens: 1, bibleCuts: 1},
    tiles: output,
  };
  return {content, document, item, value, settings};
}

it('retains one revision-bound sequence and rejects mismatched sources without replacing it', async () => {
  const source = fixture();
  const owner = registerSlidesProjection({
    content: Promise.resolve(source.content),
    settings: Promise.resolve(source.settings.reader),
    log: mockLog(),
  });
  await vi.waitFor(() => expect(source.settings.listeners.size).toBe(1));
  const receive = ipc.on.mock.calls.find(
    ([channel]) => channel === serviceEndpoints.slidesProjection.channel,
  )?.[1];
  if (typeof receive !== 'function') throw Error('Missing projection listener');
  const changed = vi.fn();
  const stop = owner.subscribe(changed);
  receive({}, source.value);
  expect(owner.get(source.value.serviceId, source.value.itemId, 1)).toEqual(
    source.value.tiles,
  );
  expect(changed).toHaveBeenCalledOnce();
  source.settings.update(settingsDocument('props', {props: []}, 2));
  expect(changed).toHaveBeenCalledOnce();
  expect(
    owner.get(source.value.serviceId, source.value.itemId, 2),
  ).toBeUndefined();
  for (const value of [
    {...source.value, revision: 2},
    {
      ...source.value,
      itemId: createServiceItemId('00000000-0000-4000-8000-000000000999'),
    },
    {...source.value, tiles: source.value.tiles.slice(1)},
    {...source.value, tiles: [...source.value.tiles].reverse()},
    {
      ...source.value,
      tiles: source.value.tiles.map(tile =>
        tile.biblePart === 2 ? {...tile, biblePart: 3} : tile,
      ),
    },
  ]) {
    receive({}, value);
  }
  expect(changed).toHaveBeenCalledOnce();
  expect(owner.get(source.value.serviceId, source.value.itemId, 1)).toEqual(
    source.value.tiles,
  );
  stop();
  owner.dispose();
  expect(source.settings.listeners.size).toBe(0);
  expect(ipc.removeListener).toHaveBeenCalledWith(
    serviceEndpoints.slidesProjection.channel,
    receive,
  );
  expect(
    owner.get(source.value.serviceId, source.value.itemId, 1),
  ).toBeUndefined();
});

it('disposes before a delayed source is ready and ignores subsequent messages', async () => {
  const source = fixture();
  let ready: ((value: typeof source.content) => void) | undefined;
  const owner = registerSlidesProjection({
    settings: Promise.resolve(source.settings.reader),
    content: new Promise(resolve => {
      ready = resolve;
    }),
    log: mockLog(),
  });
  const receive = ipc.on.mock.calls.at(-1)?.[1];
  owner.dispose();
  ready?.(source.content);
  await Promise.resolve();
  if (typeof receive !== 'function') throw Error('Missing listener');
  receive({}, source.value);
  expect(
    owner.get(source.value.serviceId, source.value.itemId, 1),
  ).toBeUndefined();
  expect(source.settings.listeners.size).toBe(0);
});

it.each(['bibleCuts', 'themes', 'screens'] as const)(
  'pauses timed output after %s changes outside Show until a current measurement arrives',
  async name => {
    vi.useFakeTimers();
    const source = fixture();
    const owner = registerSlidesProjection({
      content: Promise.resolve(source.content),
      settings: Promise.resolve(source.settings.reader),
      log: mockLog(),
    });
    await vi.waitFor(() => expect(source.settings.listeners.size).toBe(1));
    const receive = ipc.on.mock.calls.at(-1)?.[1];
    if (receive === undefined) throw Error('Missing projection listener');
    receive({}, source.value);
    const store = new LiveStore();
    store.connectMacros({run: history => history});
    const stop = followSlideAdvance({
      store,
      sequence: id => {
        const tiles = owner.get(source.value.serviceId, id, 1);
        return tiles === undefined ? undefined : {item: source.item, tiles};
      },
      subscribeSequence: owner.subscribe,
      send: command => store.dispatch(command),
    });
    try {
      const slide = slideLayerOf(
        {itemId: source.item.id, index: 1},
        () => source.value.tiles,
      );
      if (slide === null) throw Error('Missing live part');
      store.dispatch({type: 'slide.show', slide});
      vi.advanceTimersByTime(1000);
      const previous = source.settings.reader.get(name);
      source.settings.update(settingsDocument(name, previous.value, 2));
      expect(
        owner.get(source.value.serviceId, source.item.id, 1),
      ).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
      receive({}, source.value);
      vi.advanceTimersByTime(6000);
      expect(store.state.layers.slide).toBe(slide);
      receive(
        {},
        {
          ...source.value,
          measurement: {...source.value.measurement, [name]: 2},
        },
      );
      expect(store.state.layers.slide).toBe(slide);
      vi.advanceTimersByTime(3000);
      expect(store.state.layers.slide).toMatchObject({
        position: 2,
        biblePart: 2,
      });
    } finally {
      stop();
      owner.dispose();
    }
    expect(source.settings.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  },
);
