import {beforeEach, describe, expect, it, vi} from 'vitest';
import {appEndpoints} from '@contracts/ipc/app';
import type {AppProblem} from '@core/schema/appProblem';
import {recordingLogger} from '../displays/testing';
import type {StandingProblems} from '../problemFeed';
import {SaveFailures} from './saveFailures';
import {registerSaveProblems} from './saveProblems';

const electron = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, listener: () => void) => {
      electron.listeners.set(channel, listener);
    },
    removeListener: (channel: string) => {
      electron.listeners.delete(channel);
    },
  },
}));

beforeEach(() => {
  electron.listeners.clear();
});

describe('save problems', () => {
  it('lists, pushes, and retries the waiting saves on the feed, and removes everything on dispose', async () => {
    const log = recordingLogger();
    const saves = new SaveFailures({log});
    const sources = new Set<StandingProblems>();
    const push = vi.fn<(problem: AppProblem) => void>();
    const remove = registerSaveProblems(
      saves,
      {
        report: vi.fn(),
        push,
        addStanding: source => {
          sources.add(source);
          return () => {
            sources.delete(source);
          };
        },
      },
      log,
    );
    const listed = () => [...sources].flatMap(source => source());
    expect(listed()).toEqual([]);
    const retry = vi.fn(() => Promise.resolve());
    saves.waiting({file: 'a.json', name: 'a.json', retry});
    const problem = {kind: 'save-failed', name: 'a.json', count: 1};
    expect(push).toHaveBeenCalledExactlyOnceWith(problem);
    expect(listed()).toEqual([problem]);
    electron.listeners.get(appEndpoints.retrySaves.channel)?.();
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(2));
    expect(retry).toHaveBeenCalledOnce();
    remove();
    expect(sources.size).toBe(0);
    expect(electron.listeners.size).toBe(0);
    saves.saved('a.json');
    expect(push).toHaveBeenCalledTimes(2);
    saves.dispose();
  });
});
