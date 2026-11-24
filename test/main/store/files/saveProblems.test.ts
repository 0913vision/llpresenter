import {describe, expect, it, vi} from 'vitest';
import {appEndpoints} from '@contracts/ipc/app';
import type {AppProblem} from '@core/schema/appProblem';
import {recordingLogger} from '@fixtures/main/displays/testing';
import type {StandingProblems} from '@main/base/problemFeed';
import {SaveFailures} from '@main/store/files/saveFailures';
import {registerSaveProblems} from '@main/store/files/saveProblems';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({ipcMain: ipc.ipcMain}));

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
    ipc.send(appEndpoints.retrySaves);
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(2));
    expect(retry).toHaveBeenCalledOnce();
    remove();
    expect(sources.size).toBe(0);
    expect(ipc.open()).toBe(0);
    saves.saved('a.json');
    expect(push).toHaveBeenCalledTimes(2);
    saves.dispose();
  });

  it('includes unresolved copy failures in reload snapshots without retrying saved edits', () => {
    const log = recordingLogger();
    const saves = new SaveFailures({log});
    let standing: StandingProblems = () => [];
    const push = vi.fn();
    const stop = registerSaveProblems(
      saves,
      {
        report: vi.fn(),
        push,
        addStanding: source => {
          standing = source;
          return () => undefined;
        },
      },
      log,
    );
    saves.copyResult('saved-song', false);
    expect(standing()).toEqual([
      {kind: 'protection-write', target: 'copies', failed: true},
    ]);
    expect(saves.problems()).toEqual([]);
    saves.copyResult('saved-song', true);
    expect(standing()).toEqual([]);
    expect(push).toHaveBeenLastCalledWith({
      kind: 'protection-write',
      target: 'copies',
      failed: false,
    });
    stop();
    saves.dispose();
  });
});
