import {describe, expect, it, vi} from 'vitest';
import type {SettingsEdit} from '@shared/schema/settingsDocuments';
import type {EditResult} from '@shared/schema/contentEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {ScreenEditor} from './screenEditor';
import {CAPTIONS_ID, MAIN_ID, screensDocument} from './testing/documents';

function screensAt(revision: number) {
  const document = screensDocument(revision);
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document;
}

function setup(results: readonly EditResult[] = []) {
  const edits: SettingsEdit[] = [];
  const pending = [...results];
  const write = vi.fn();
  const report = vi.fn();
  const api = fakeLlpApi({
    settings: {
      edit: edit => {
        edits.push(edit);
        return Promise.resolve(
          pending.shift() ?? {ok: true, value: {id: 'screens', revision: 0}},
        );
      },
    },
    log: {write},
  });
  const editor = new ScreenEditor(api, report);
  return {editor, edits, report, write};
}

const saved = (revision: number): EditResult => ({
  ok: true,
  value: {id: 'screens', revision},
});

describe('ScreenEditor', () => {
  it('makes the close flush wait for a held save and a queued change', async () => {
    let finishFirst: (result: EditResult) => void = () => undefined;
    let finishSecond: (result: EditResult) => void = () => undefined;
    const firstReply = new Promise<EditResult>(resolve => {
      finishFirst = resolve;
    });
    const secondReply = new Promise<EditResult>(resolve => {
      finishSecond = resolve;
    });
    const edit = vi
      .fn()
      .mockReturnValueOnce(firstReply)
      .mockReturnValueOnce(secondReply);
    const api = fakeLlpApi({settings: {edit}});
    const editor = new ScreenEditor(api, vi.fn());
    editor.adopt(screensAt(1));
    const first = editor.change(MAIN_ID, {name: '본당'});
    await vi.waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    const second = editor.change(MAIN_ID, {alwaysOnTop: false});
    const flushed = vi.fn();
    const writes = pendingWritesOf(api);
    const closing = writes.flush().then(flushed);
    expect(writes.isStopped).toBe(true);
    expect(flushed).not.toHaveBeenCalled();

    finishFirst(saved(2));
    await first;
    await vi.waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(flushed).not.toHaveBeenCalled();
    await editor.change(MAIN_ID, {kind: 'stage'});
    expect(edit).toHaveBeenCalledTimes(2);

    finishSecond(saved(3));
    await Promise.all([second, closing]);
    expect(flushed).toHaveBeenCalledWith(true);
    expect(edit.mock.calls[1]?.[0]).toMatchObject({
      baseRevision: 2,
      value: {
        screens: [
          {name: '본당', alwaysOnTop: false},
          {id: CAPTIONS_ID},
          {name: '무대 화면'},
        ],
      },
    });
  });

  it('refuses the close when a queued save cannot reach main', async () => {
    const edit = vi.fn().mockRejectedValue(new Error('offline'));
    const api = fakeLlpApi({settings: {edit}});
    const editor = new ScreenEditor(api, vi.fn());
    editor.adopt(screensAt(1));
    const changing = editor.change(MAIN_ID, {name: '본당'});
    expect(await pendingWritesOf(api).flush()).toBe(false);
    await changing;
  });

  it('sends no edits for a read-only document', async () => {
    const {editor, edits} = setup();
    editor.adopt({...screensAt(1), access: 'readOnly'});
    await editor.change(MAIN_ID, {name: '본당'});
    expect(edits).toEqual([]);
  });

  it('saves the changed screen against the revision it was given', async () => {
    const {editor, edits} = setup([saved(2)]);
    editor.adopt(screensAt(1));

    await editor.change(MAIN_ID, {name: '본당'});

    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      type: 'settings.update',
      name: 'screens',
      baseRevision: 1,
    });
    const names =
      edits[0]?.name === 'screens'
        ? edits[0].value.screens.map(screen => screen.name)
        : [];
    expect(names).toEqual(['본당', '방송 자막', '무대 화면']);
  });

  it('builds the next save on the last save, before the window hears of it', async () => {
    const {editor, edits} = setup([saved(2), saved(3)]);
    editor.adopt(screensAt(1));

    const first = editor.change(MAIN_ID, {name: '본당'});
    const second = editor.change(CAPTIONS_ID, {alwaysOnTop: true});
    await Promise.all([first, second]);

    expect(
      edits.map(edit => 'baseRevision' in edit && edit.baseRevision),
    ).toEqual([1, 2]);
    const last = edits[1];
    const screens = last?.name === 'screens' ? last.value.screens : [];
    expect(screens.map(screen => screen.name)).toEqual([
      '본당',
      '방송 자막',
      '무대 화면',
    ]);
    expect(screens[1]?.alwaysOnTop).toBe(true);
  });

  it('keeps the newest document it has seen', async () => {
    const {editor, edits} = setup([saved(6)]);
    editor.adopt(screensAt(5));
    editor.adopt(screensAt(4));

    await editor.change(MAIN_ID, {kind: 'stage'});

    expect(edits[0]).toMatchObject({baseRevision: 5});
  });

  it('does nothing before it has a document', async () => {
    const {editor, edits, report} = setup();

    await editor.change(MAIN_ID, {kind: 'stage'});

    expect(edits).toEqual([]);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a refused save and builds the next one on the revision it still has', async () => {
    const stale: EditResult = {
      ok: false,
      error: {reason: 'stale', message: 'The screens changed'},
    };
    const {editor, edits, report} = setup([stale, saved(2)]);
    editor.adopt(screensAt(1));

    await editor.change(MAIN_ID, {kind: 'stage'});
    await editor.change(MAIN_ID, {kind: 'audience'});

    expect(report).toHaveBeenCalledWith('The screens changed');
    expect(
      edits.map(edit => 'baseRevision' in edit && edit.baseRevision),
    ).toEqual([1, 1]);
  });

  it('counts a save that only failed to reach the disk as applied, and reports it', async () => {
    const unwritten: EditResult = {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Could not write the screens',
        applied: {id: 'screens', revision: 2},
        unchangedFiles: ['screens.json'],
      },
    };
    const {editor, edits, report} = setup([unwritten, saved(3)]);
    editor.adopt(screensAt(1));

    await editor.change(MAIN_ID, {kind: 'stage'});
    await editor.change(MAIN_ID, {kind: 'audience'});

    expect(report).toHaveBeenCalledWith('Could not write the screens');
    expect(edits[1]).toMatchObject({baseRevision: 2});
  });

  it('logs and reports a save that throws, then goes on', async () => {
    const write = vi.fn();
    const report = vi.fn();
    const edit = vi
      .fn()
      .mockRejectedValueOnce(new Error('no answer'))
      .mockResolvedValueOnce(saved(2));
    const editor = new ScreenEditor(
      fakeLlpApi({settings: {edit}, log: {write}}),
      report,
    );
    editor.adopt(screensAt(1));

    await editor.change(MAIN_ID, {kind: 'stage'});
    await editor.change(MAIN_ID, {kind: 'audience'});

    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({level: 'error', detail: 'no answer'}),
    );
    expect(report).toHaveBeenCalledWith('화면 설정 저장 실패');
    expect(edit).toHaveBeenCalledTimes(2);
  });
});
