import {vi} from 'vitest';
import type {LlpApi} from '@shared/ipc';
import {isKnownQuickItem, type QuickItemKind} from '@shared/schema/quick';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@shared/schema/settingsDocuments';
import {parseShowLibrarySong} from '@shared/schema/showLibrarySong';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {emptyLiveState} from '@shared/live';
import {parseLiveState} from '@shared/schema/liveState';
import {panelApi} from '../bible/panelTesting';

export const quickId = (value: number): string =>
  `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

export function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(finish => {
    resolve = finish;
  });
  return {promise, resolve};
}

export function quickDocument(revision = 1) {
  const parsed = parseSettingsDocument({
    name: 'quick',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.quick',
      schemaVersion: 1,
      items: [
        {name: '저장된 곡', kind: 'song', ref: quickId(101)},
        {
          name: '저장된 구절',
          kind: 'bible',
          ref: {
            translation: 'sample',
            ref: '요한복음 3:16-18',
            split: 'verse',
            reference: 'none',
            verseNumbers: true,
            translationName: false,
          },
        },
        {name: '로고 화면', kind: 'prop', ref: quickId(103)},
        {
          name: '시작 카운트다운',
          kind: 'timer',
          ref: quickId(104),
        },
        {name: '시작 매크로', kind: 'macro', ref: quickId(105)},
        {name: '검은 화면', kind: 'black'},
        {name: '새 버전 항목', kind: 'future', extension: true},
      ].map((item, index) => ({id: quickId(index + 1), ...item})),
    },
  });
  if (!parsed.ok || parsed.value.name !== 'quick') {
    throw new Error('Invalid quick fixture');
  }
  return parsed.value;
}

export function quickItem(kind: QuickItemKind) {
  const item = quickDocument().value.items.find(item => item.kind === kind);
  if (!item || !isKnownQuickItem(item)) {
    throw new Error('Missing quick fixture');
  }
  return item;
}

export function quickLive() {
  const live = emptyLiveState();
  const parsed = parseLiveState({
    ...live,
    layers: {
      ...live.layers,
      prop: {
        propId: quickId(99),
        items: [
          {
            propId: quickId(103),
            content: {kind: 'image', media: quickId(102)},
            targets: [],
          },
        ],
      },
    },
    timers: {
      [quickId(104)]: {state: 'running', since: 0, countedMs: 0, day: 0},
    },
  });
  if (!parsed.ok) throw new Error('Invalid quick live fixture');
  return parsed.value;
}

export function quickFixture() {
  const bible = panelApi();
  let document = quickDocument();
  const listeners = new Set<(value: SettingsDocument) => void>();
  const song = parseShowLibrarySong({
    songId: quickId(101),
    songRevision: 1,
    title: '저장된 곡',
    readOnly: false,
    tiles: [{label: '절 1', labelColor: 'none', lines: ['Invented song']}],
    jumpKeys: {},
    background: {mediaId: quickId(102), loop: true},
  });
  if (!song.ok || song.value === null) throw new Error('Invalid song fixture');
  const showSong = vi.fn<LlpApi['library']['showSong']>(() =>
    Promise.resolve(song.value),
  );
  const get = vi.fn<LlpApi['settings']['get']>(request =>
    request.name === 'quick' ? Promise.resolve(document) : bible.get(request),
  );
  const api = fakeLlpApi({
    ...bible.api,
    log: {write: vi.fn()},
    library: {showSong},
    settings: {
      ...bible.api.settings,
      get,
      subscribe: listener => {
        listeners.add(listener);
        const stop = bible.api.settings.subscribe(listener);
        return () => {
          listeners.delete(listener);
          stop();
        };
      },
    },
  });
  return {
    ...bible,
    api,
    get,
    showSong,
    song: song.value,
    pushQuick: (next: ReturnType<typeof quickDocument>) => {
      document = next;
      for (const listener of listeners) listener(next);
    },
    quickListeners: () => listeners.size,
  };
}
