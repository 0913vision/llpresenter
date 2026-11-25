import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {SettingsStore} from '@main/store/settings/settingsStore';

describe('settings problem subscriptions', () => {
  const problem = {
    file: 'themes.json',
    error: {
      kind: 'json',
      file: '/settings/themes.json',
      field: '',
      message: 'Broken JSON',
    },
  } as const;

  it('replays one event per skipped file, deduplicates a listener, and releases it', async () => {
    const store = new SettingsStore({
      documents: new Map(),
      problems: [problem],
      log: recordingLogger(),
    });
    const listener = vi.fn();
    const remove = store.subscribeProblems(listener);
    store.subscribeProblems(listener);
    expect(listener).toHaveBeenCalledExactlyOnceWith(problem);
    expect(store.listenerCount).toBe(1);
    remove();
    expect(store.listenerCount).toBe(0);
    store.subscribeProblems(listener);
    await store.dispose();
    expect(store.listenerCount).toBe(0);
    const late = vi.fn();
    store.subscribeProblems(late);
    expect(late).not.toHaveBeenCalled();
  });

  it('keeps a failing listener from preventing later listeners', async () => {
    const log = recordingLogger();
    const store = new SettingsStore({
      documents: new Map(),
      problems: [problem],
      log,
    });
    store.subscribeProblems(() => {
      throw new Error('listener failed');
    });
    const listener = vi.fn();
    store.subscribeProblems(listener);
    expect(listener).toHaveBeenCalledWith(problem);
    expect(log.messages('error')).toEqual(['settings problem listener failed']);
    await store.dispose();
  });
});

describe('settings problems added later', () => {
  function problemOf(file: string) {
    return {
      file,
      error: {
        kind: 'json',
        file: `/settings/${file}`,
        field: '',
        message: 'Broken JSON',
      },
    } as const;
  }

  it('tells each listener of a new problem once, and keeps the feed bounded', async () => {
    const log = recordingLogger();
    const store = new SettingsStore({documents: new Map(), problems: [], log});
    const listener = vi.fn();
    store.subscribeProblems(listener);
    store.addProblems([problemOf('media.json'), problemOf('media.json')]);
    expect(listener).toHaveBeenCalledOnce();
    store.addProblems(
      Array.from({length: 30}, (_, index) => problemOf(`f${index}.json`)),
    );
    expect(log.messages('warn')).toContain(
      'too many app-wide settings problems',
    );
    const count = listener.mock.calls.length;
    await store.dispose();
    store.addProblems([problemOf('late.json')]);
    expect(listener).toHaveBeenCalledTimes(count);
  });
});
