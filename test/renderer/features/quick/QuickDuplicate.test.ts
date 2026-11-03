import {describe, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import {createQuickItemId, createTimerId} from '@core/schema/ids';
import {
  parseSettingsDocument,
  type SettingsDocument,
  type SettingsEdit,
} from '@core/schema/settingsDocuments';
import {MAX_QUICK_ITEMS} from '@core/schema/quick';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {saveQuickEdit} from '@renderer/features/quick/quickEdits';

const uuid = (kind: number, n: number): string =>
  `${String(kind).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

function documentOf(
  name: SettingsDocument['name'],
  value: object,
  revision: number,
): SettingsDocument {
  const parsed = parseSettingsDocument({
    name,
    revision,
    access: 'editable',
    value,
  });
  if (!parsed.ok) throw new Error(`Invalid ${name} fixture`);
  return parsed.value;
}

const quickFile = (items: readonly object[]) => ({
  format: 'llsettings.quick',
  schemaVersion: 1,
  items,
});

function apiFor(quick: object, timers?: object) {
  const documents = {
    quick: documentOf('quick', quick, 5),
    timers: documentOf(
      'timers',
      timers ?? {format: 'llsettings.timers', schemaVersion: 1, timers: []},
      7,
    ),
  };
  const edit = vi
    .fn<(request: SettingsEdit) => Promise<EditResult>>()
    .mockImplementation(request =>
      Promise.resolve({
        ok: true,
        value: {id: request.name, revision: 9},
      }),
    );
  const api = mockLlpApi({
    settings: {
      get: ({name}) =>
        Promise.resolve(name === 'timers' ? documents.timers : documents.quick),
      edit,
    },
  });
  return {api, edit};
}

function updated(
  edit: ReturnType<typeof apiFor>['edit'],
  call: number,
  file: 'quick' | 'timers',
): unknown {
  const request = edit.mock.calls[call]?.[0];
  if (request?.type !== 'settings.update' || request.name !== file) {
    throw new Error(`Expected a ${file} update`);
  }
  return request.value;
}

describe('복제 of a 퀵 실행 항목', () => {
  const black = {id: uuid(7, 1), name: '검은 화면', kind: 'black'};
  const song = {
    id: uuid(7, 2),
    name: '저장된 곡',
    kind: 'song',
    ref: uuid(8, 1),
  };

  it('copies a row that is not a 타이머 with the same ref, after the original', async () => {
    const {api, edit} = apiFor(quickFile([song, black]));
    const copyId = createQuickItemId(uuid(7, 50));
    await saveQuickEdit(api, {
      kind: 'duplicate',
      id: createQuickItemId(uuid(7, 2)),
      copyId,
    });
    expect(updated(edit, 0, 'quick')).toMatchObject({
      items: [
        {id: uuid(7, 2), name: '저장된 곡'},
        {id: copyId, name: '저장된 곡 복사본', kind: 'song', ref: uuid(8, 1)},
        {id: uuid(7, 1), name: '검은 화면'},
      ],
    });
    expect(edit).toHaveBeenCalledOnce();
  });

  it('gives the copy of a 타이머 row its own new 타이머 with the copy name on both', async () => {
    const timer = {
      id: uuid(4, 1),
      name: '설교',
      kind: 'countdown',
      duration: 600,
      overrun: true,
    };
    const row = {id: uuid(7, 3), name: '설교', kind: 'timer', ref: uuid(4, 1)};
    const {api, edit} = apiFor(quickFile([row, black]), {
      format: 'llsettings.timers',
      schemaVersion: 1,
      timers: [timer],
    });
    const copyId = createQuickItemId(uuid(7, 50));
    const timerCopyId = createTimerId(uuid(4, 50));
    await saveQuickEdit(api, {
      kind: 'duplicate',
      id: createQuickItemId(uuid(7, 3)),
      copyId,
      timerCopyId,
    });
    expect(updated(edit, 0, 'timers')).toMatchObject({
      timers: [
        {id: uuid(4, 1), name: '설교'},
        {id: timerCopyId, name: '설교 복사본', duration: 600},
      ],
    });
    expect(updated(edit, 1, 'quick')).toMatchObject({
      items: [
        {id: uuid(7, 3), ref: uuid(4, 1)},
        {id: copyId, kind: 'timer', ref: timerCopyId, name: '설교 복사본'},
        {id: uuid(7, 1)},
      ],
    });
  });

  it('refuses a copy past the cap and one of a missing original, writing nothing', async () => {
    const full = Array.from({length: MAX_QUICK_ITEMS}, (_, n) => ({
      id: uuid(7, 100 + n),
      name: `항목 ${n}`,
      kind: 'black',
    }));
    const {api, edit} = apiFor(quickFile(full));
    await expect(
      saveQuickEdit(api, {
        kind: 'duplicate',
        id: createQuickItemId(uuid(7, 100)),
        copyId: createQuickItemId(uuid(7, 900)),
      }),
    ).rejects.toThrow('is full');
    const few = apiFor(quickFile([black]));
    await expect(
      saveQuickEdit(few.api, {
        kind: 'duplicate',
        id: createQuickItemId(uuid(7, 77)),
        copyId: createQuickItemId(uuid(7, 901)),
      }),
    ).rejects.toThrow('no longer exists');
    expect(edit).not.toHaveBeenCalled();
    expect(few.edit).not.toHaveBeenCalled();
  });
});
