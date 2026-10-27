import {describe, expect, it, vi} from 'vitest';
import type {SettingsEdit} from '@shared/schema/settingsDocuments';
import type {EditResult} from '@shared/schema/contentEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {ScreenEditor} from './screenEditor';
import {CAPTIONS_ID, MAIN_ID, screensDocument} from './testing/documents';
import {STAGE_ID} from './testing/documents';
import {projector} from './testing/monitors';
import {parseScreenId} from '@shared/schema/ids';

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
  it('checks rapid row renames against the latest queued names without writing a refusal', async () => {
    const {editor, edits} = setup([saved(2)]);
    editor.adopt(screensAt(1));
    const first = editor.rename(MAIN_ID, '공통 이름');
    const second = editor.rename(CAPTIONS_ID, ' 공통 이름 ');
    expect(await first).toEqual({ok: true, value: true});
    expect(await second).toEqual({ok: false, error: 'taken'});
    expect(await editor.rename(MAIN_ID, '공통 이름')).toEqual({
      ok: true,
      value: true,
    });
    expect(await editor.rename(MAIN_ID, ' ')).toEqual({
      ok: false,
      error: 'empty',
    });
    expect(edits).toHaveLength(1);
  });

  it('keeps queued removal in the close flush and preserves siblings and unknown fields', async () => {
    let release: (result: EditResult) => void = () => undefined;
    const held = new Promise<EditResult>(resolve => {
      release = resolve;
    });
    const edits: SettingsEdit[] = [];
    const api = fakeLlpApi({
      settings: {
        edit: edit => {
          edits.push(edit);
          return edits.length === 1 ? held : Promise.resolve(saved(3));
        },
      },
    });
    const editor = new ScreenEditor(api, vi.fn());
    const document = screensAt(1);
    const value = {
      ...document.value,
      future: 'file',
      screens: document.value.screens.map(screen => ({
        ...screen,
        future: 'screen',
      })),
    };
    editor.adopt({...document, value});
    const changing = editor.change(MAIN_ID, {offset: {x: 20}});
    await vi.waitFor(() => expect(edits).toHaveLength(1));
    const removing = editor.remove(CAPTIONS_ID);
    let closed = false;
    const closing = pendingWritesOf(api)
      .flush()
      .then(result => {
        closed = true;
        return result;
      });
    await Promise.resolve();
    expect(closed).toBe(false);
    release(saved(2));
    await changing;
    expect(await removing).toBe(true);
    expect(await closing).toBe(true);
    const removed = edits[1];
    if (removed?.name !== 'screens') throw new Error('Missing removal');
    expect(removed.baseRevision).toBe(2);
    expect(removed.value).toMatchObject({future: 'file'});
    expect(removed.value.screens.map(screen => screen.id)).toEqual([
      MAIN_ID,
      STAGE_ID,
    ]);
    expect(removed.value.screens[0]).toMatchObject({
      future: 'screen',
      offset: {x: 20},
    });
  });

  it('refuses read-only row operations and treats an already removed target as a no-op', async () => {
    const {editor, edits} = setup();
    editor.adopt({...screensAt(1), access: 'readOnly'});
    expect(await editor.remove(MAIN_ID)).toBe(false);
    expect(await editor.rename(MAIN_ID, '거절')).toEqual({
      ok: true,
      value: false,
    });
    editor.adopt({
      ...screensAt(2),
      value: {...screensAt(2).value, screens: []},
    });
    expect(await editor.remove(MAIN_ID)).toBe(true);
    expect(await editor.rename(MAIN_ID, '없음')).toEqual({
      ok: false,
      error: 'missing',
    });
    expect(edits).toHaveLength(0);
  });

  it('names rapid creations against the preceding save without waiting for a push', async () => {
    const first = parseScreenId('00000000-0000-4000-8000-000000000201');
    const second = parseScreenId('00000000-0000-4000-8000-000000000202');
    if (!first.ok || !second.ok) throw new Error('Invalid fixture id');
    const {editor, edits} = setup([saved(2), saved(3)]);
    editor.adopt(screensAt(1));
    const adding = editor.add({
      id: first.value,
      kind: 'audience',
      method: 'fullscreen',
    });
    const queued = editor.add({
      id: second.value,
      kind: 'audience',
      method: 'capture',
    });
    expect(await adding).toBe(true);
    expect(await queued).toBe(true);
    const request = edits[1];
    if (request?.name !== 'screens') throw new Error('Missing queued edit');
    expect(request.baseRevision).toBe(2);
    expect(request.value.screens.slice(-2).map(screen => screen.name)).toEqual([
      '새 청중 화면',
      '새 청중 화면 (2)',
    ]);
  });
  it('serializes screen creation against a held property save and includes it in close flush', async () => {
    const id = parseScreenId('00000000-0000-4000-8000-000000000201');
    if (!id.ok) throw new Error('Invalid fixture id');
    let release: (result: EditResult) => void = () => undefined;
    const held = new Promise<EditResult>(resolve => {
      release = resolve;
    });
    const edit = vi
      .fn<(value: SettingsEdit) => Promise<EditResult>>()
      .mockImplementationOnce(() => held)
      .mockResolvedValue(saved(3));
    const api = fakeLlpApi({settings: {edit}});
    const editor = new ScreenEditor(api, vi.fn());
    editor.adopt(screensAt(1));
    const property = editor.change(MAIN_ID, {name: 'Renamed'});
    const adding = editor.add({id: id.value, kind: 'stage', method: 'window'});
    let flushed = false;
    const flush = pendingWritesOf(api)
      .flush()
      .then(result => {
        flushed = true;
        return result;
      });
    await Promise.resolve();
    expect(edit).toHaveBeenCalledOnce();
    expect(flushed).toBe(false);
    release(saved(2));
    await property;
    expect(await adding).toBe(true);
    expect(await flush).toBe(true);
    const request = edit.mock.calls[1]?.[0];
    expect(request).toMatchObject({name: 'screens', baseRevision: 2});
    if (request?.name !== 'screens') {
      throw new Error('Missing queued screen edit');
    }
    expect(request.value.screens[0]?.name).toBe('Renamed');
    expect(request.value.screens.at(-1)).toMatchObject({
      id: id.value,
      kind: 'stage',
      method: 'window',
      alwaysOnTop: false,
    });
  });

  it('refuses screen creation for a read-only document', async () => {
    const id = parseScreenId('00000000-0000-4000-8000-000000000201');
    if (!id.ok) throw new Error('Invalid fixture id');
    const {editor, edits} = setup();
    editor.adopt({...screensAt(1), access: 'readOnly'});
    expect(
      await editor.add({id: id.value, kind: 'audience', method: 'fullscreen'}),
    ).toBe(false);
    expect(edits).toHaveLength(0);
  });
  it.each([true, false])(
    'keeps the original feed snapshot when it arrives before the document: %s',
    async feedFirst => {
      const {editor, edits} = setup([saved(2), saved(3)]);
      const monitor3 = {...projector, id: 3, number: 3, screenIds: []};
      if (feedFirst) editor.observeMonitors([projector, monitor3]);
      editor.adopt(screensAt(1));
      if (!feedFirst) editor.observeMonitors([projector, monitor3]);
      await editor.assign(MAIN_ID, monitor3);
      await editor.assign(STAGE_ID, projector);
      const last = edits[1];
      expect(
        last?.name === 'screens' && last.value.screens[0]?.display?.id,
      ).toBe(3);
      expect(
        last?.name === 'screens' && last.value.screens[2]?.display?.id,
      ).toBe(2);
    },
  );

  it('releases a newly published fallback owner after an earlier move', async () => {
    const {editor, edits} = setup([saved(2), saved(3)]);
    editor.adopt(screensAt(1));
    const monitor3 = {...projector, id: 3, number: 3, screenIds: []};
    editor.observeMonitors([projector, monitor3]);
    await editor.assign(MAIN_ID, monitor3);
    const fallback = {...projector};
    editor.observeMonitors([fallback]);
    await editor.assign(STAGE_ID, fallback);
    const last = edits[1];
    expect(
      last?.name === 'screens' && last.value.screens[0]?.display,
    ).toBeUndefined();
    expect(last?.name === 'screens' && last.value.screens[2]?.display?.id).toBe(
      2,
    );
  });

  it('preserves both assignments in a queued swap before the monitor feed changes', async () => {
    const initial = screensAt(1);
    const monitor2 = {...projector, number: 2};
    const monitor3 = {
      ...projector,
      id: 3,
      number: 3,
      name: 'Stage',
      screenIds: [STAGE_ID],
    };
    let release: (result: EditResult) => void = () => undefined;
    const held = new Promise<EditResult>(resolve => {
      release = resolve;
    });
    const edits: SettingsEdit[] = [];
    const api = fakeLlpApi({
      settings: {
        edit: edit => {
          edits.push(edit);
          return edits.length === 1 ? held : Promise.resolve(saved(3));
        },
      },
    });
    const editor = new ScreenEditor(api, vi.fn());
    editor.adopt({
      ...initial,
      value: {
        ...initial.value,
        screens: initial.value.screens.map(screen =>
          screen.id === STAGE_ID
            ? {
                ...screen,
                display: {
                  id: 3,
                  number: 3,
                  name: monitor3.name,
                  bounds: monitor3.bounds,
                  scaleFactor: monitor3.scaleFactor,
                },
              }
            : screen,
        ),
      },
    });
    const moveA = editor.assign(MAIN_ID, monitor3);
    await vi.waitFor(() => expect(edits).toHaveLength(1));
    const moveB = editor.assign(STAGE_ID, monitor2);
    const closing = pendingWritesOf(api).flush();
    release(saved(2));
    await Promise.all([moveA, moveB]);
    expect(await closing).toBe(true);
    expect(edits).toHaveLength(2);
    const last = edits[1];
    expect(last).toMatchObject({baseRevision: 2});
    expect(last?.name === 'screens' && last.value.screens[0]?.display?.id).toBe(
      3,
    );
    expect(last?.name === 'screens' && last.value.screens[2]?.display?.id).toBe(
      2,
    );
  });

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
    const second = editor.assign(STAGE_ID, projector);
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
          {name: '본당'},
          {id: CAPTIONS_ID},
          {name: '무대 화면', display: {id: 2}},
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

  it('assigns and clears in one save, then builds the next change on it', async () => {
    const {editor, edits} = setup([saved(2), saved(3)]);
    editor.adopt(screensAt(1));
    const assign = editor.assign(STAGE_ID, projector);
    const change = editor.change(STAGE_ID, {name: '무대'});
    await Promise.all([assign, change]);
    expect(edits).toHaveLength(2);
    const first = edits[0];
    expect(
      first?.name === 'screens' && first.value.screens[0]?.display,
    ).toBeUndefined();
    expect(
      first?.name === 'screens' && first.value.screens[2]?.display?.id,
    ).toBe(2);
    expect(edits[1]).toMatchObject({baseRevision: 2});
    const last = edits[1];
    expect(last?.name === 'screens' && last.value.screens[2]).toMatchObject({
      name: '무대',
      display: {id: 2},
    });
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
