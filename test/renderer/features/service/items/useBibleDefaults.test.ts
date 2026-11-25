import {act, renderHook, waitFor} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {
  defaultPreferences,
  type Preferences,
} from '@core/schema/app/preferences';
import {LIVE_BIBLE_ID} from '@core/schema/common/ids';
import {useBibleDefaults} from '@renderer/features/service/items/useBibleDefaults';
import {bibleDocument} from '@fixtures/contracts/ipc/bibleApi';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

function withoutVerseNumbers(): Preferences {
  return {
    ...defaultPreferences,
    bible: {
      ...defaultPreferences.bible,
      defaults: {...defaultPreferences.bible.defaults, verseNumbers: false},
    },
  };
}

function setup(bible = bibleDocument()) {
  const listeners = new Set<(value: Preferences) => void>();
  const api = mockLlpApi({
    settings: {get: () => Promise.resolve(bible)},
    preferences: {
      get: () => Promise.resolve(defaultPreferences),
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  });
  window.llp = api;
  onTestFinished(() => {
    delete window.llp;
  });
  return {
    listeners,
    change: (value: Preferences) => {
      for (const listener of listeners) listener(value);
    },
  };
}

it('starts a passage with the default translation and the verse number setting', async () => {
  setup();
  const {result} = renderHook(() => useBibleDefaults());
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current).not.toBeNull());
  expect(result.current).toMatchObject({
    translation: 'sample',
    verseNumbers: true,
  });
  expect(result.current?.translations.map(item => item.id)).toEqual(['sample']);
});

it('uses the built-in Bible when no translation is the default', async () => {
  const document = bibleDocument();
  setup({...document, value: {...document.value, translations: []}});
  const {result} = renderHook(() => useBibleDefaults());
  await waitFor(() => expect(result.current?.translation).toBe(LIVE_BIBLE_ID));
});

it('follows a changed verse number setting, and stops following when it is gone', async () => {
  const preferences = setup();
  const {result, unmount} = renderHook(() => useBibleDefaults());
  await waitFor(() => expect(result.current).not.toBeNull());
  act(() => preferences.change(withoutVerseNumbers()));
  expect(result.current?.verseNumbers).toBe(false);
  unmount();
  expect(preferences.listeners.size).toBe(0);
});

it('keeps a setting that changed before the first read answered', async () => {
  const preferences = setup();
  const {result} = renderHook(() => useBibleDefaults());
  act(() => preferences.change(withoutVerseNumbers()));
  await waitFor(() => expect(result.current).not.toBeNull());
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current?.verseNumbers).toBe(false);
});

it('logs why the defaults could not be read', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onTestFinished(() => error.mockRestore());
  window.llp = mockLlpApi({
    settings: {get: () => Promise.reject(new Error('settings gone'))},
  });
  onTestFinished(() => {
    delete window.llp;
  });
  const {result} = renderHook(() => useBibleDefaults());
  await waitFor(() =>
    expect(error).toHaveBeenCalledWith(
      'Could not read the Bible defaults',
      expect.any(Error),
    ),
  );
  expect(result.current).toBeNull();
});
