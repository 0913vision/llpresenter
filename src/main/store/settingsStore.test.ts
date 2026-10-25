import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {SettingsStore} from './settingsStore';

describe('settings problem subscriptions', () => {
  const problem = {
    file: 'looks.json',
    error: {
      kind: 'json',
      file: '/settings/looks.json',
      field: '',
      message: 'Broken JSON',
    },
  } as const;

  it('replays one event per skipped file, deduplicates a listener, and releases it', () => {
    const store = new SettingsStore(new Map(), [problem], recordingLogger());
    const listener = vi.fn();
    const remove = store.subscribeProblems(listener);
    store.subscribeProblems(listener);
    expect(listener).toHaveBeenCalledExactlyOnceWith(problem);
    expect(store.listenerCount).toBe(1);
    remove();
    expect(store.listenerCount).toBe(0);
    store.subscribeProblems(listener);
    store.dispose();
    expect(store.listenerCount).toBe(0);
    const late = vi.fn();
    store.subscribeProblems(late);
    expect(late).not.toHaveBeenCalled();
  });

  it('keeps a failing listener from preventing later listeners', () => {
    const log = recordingLogger();
    const store = new SettingsStore(new Map(), [problem], log);
    store.subscribeProblems(() => {
      throw new Error('listener failed');
    });
    const listener = vi.fn();
    store.subscribeProblems(listener);
    expect(listener).toHaveBeenCalledWith(problem);
    expect(log.messages('error')).toEqual(['settings problem listener failed']);
    store.dispose();
  });
});
