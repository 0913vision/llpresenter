import {afterEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/app/settingsDocuments';
import type {EditResult} from '@core/schema/services/contentEdit';
import type {LabelColorPreview} from '@core/schema/services/labelColorPreview';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {LabelCatalog} from '@renderer/features/labels/labelCatalog';
import type {Notice} from '@renderer/ui/popups/notices';

function labels(revision: number, names: readonly string[]): SettingsDocument {
  return settingsDocument(
    'labels',
    {labels: names.map(name => ({name, color: '#5FB8C2'}))},
    revision,
  );
}

function applied(revision: number): EditResult {
  return {ok: true, value: {id: 'labels', revision}};
}

function setUp(
  first: SettingsDocument = labels(1, ['찬양', '말씀']),
  edit: (request: SettingsEdit) => Promise<EditResult> = async () => applied(2),
) {
  let stored = first;
  let pushPreview: (preview: LabelColorPreview | null) => void = () =>
    undefined;
  let push: (document: SettingsDocument) => void = () => undefined;
  const settings: Partial<LlpApi['settings']> = {
    get: vi.fn(async () => stored),
    edit: vi.fn(async (request: SettingsEdit) => {
      const result = await edit(request);
      const next = result.ok
        ? result.value.revision
        : result.error.reason === 'write-failed'
          ? result.error.applied.revision
          : null;
      if (next !== null && request.type === 'labels.rename') {
        stored = labels(next, [request.to, '말씀']);
      } else if (next !== null && request.type === 'settings.update') {
        stored = settingsDocument('labels', request.value, next);
      }
      return result;
    }),
    subscribe: listener => {
      push = listener;
      return () => undefined;
    },
    subscribeLabelColorPreview: listener => {
      pushPreview = listener;
      return () => undefined;
    },
    previewLabelColor: vi.fn(async () => true),
  };
  const saveRetry = vi.fn(async (): Promise<EditResult> => applied(3));
  const api = mockLlpApi({settings, content: {edit: saveRetry}});
  const notices: Notice[] = [];
  const catalog = new LabelCatalog(api, notice => notices.push(notice));
  return {
    catalog,
    settings,
    saveRetry,
    notices,
    push: (document: SettingsDocument) => push(document),
    pushPreview: (preview: LabelColorPreview | null) => pushPreview(preview),
  };
}

function names(catalog: LabelCatalog): string[] {
  return (
    catalog.getSnapshot().labels?.value.labels.map(label => label.name) ?? []
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

it('reads the 이름표 at once and takes only newer files after that', async () => {
  const {catalog, push} = setUp();
  expect(catalog.getSnapshot().status).toBe('loading');
  await vi.waitFor(() => expect(catalog.getSnapshot().status).toBe('ready'));
  expect(names(catalog)).toEqual(['찬양', '말씀']);
  push(labels(1, ['옛 이름표']));
  expect(names(catalog)).toEqual(['찬양', '말씀']);
  push(labels(5, ['새 이름표']));
  expect(names(catalog)).toEqual(['새 이름표']);
});

it('says the 이름표 could not be read, and reads them again on 다시 시도', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const {catalog, settings, notices} = setUp();
  vi.mocked(settings.get)?.mockRejectedValueOnce(new Error('locked'));
  const second = new LabelCatalog(mockLlpApi({settings}), notice =>
    notices.push(notice),
  );
  await vi.waitFor(() => expect(second.getSnapshot().status).toBe('failed'));
  const [notice] = notices;
  expect(notice?.title).toBe('이름표 불러오기 실패');
  notice?.actions?.[0]?.onSelect();
  await vi.waitFor(() => expect(second.getSnapshot().status).toBe('ready'));
  catalog.dispose();
  second.dispose();
});

it('shows a color being tried without storing it, until the next file comes', async () => {
  const {catalog, settings, push} = setUp();
  await vi.waitFor(() => expect(catalog.getSnapshot().status).toBe('ready'));
  catalog.previewLabelColor('찬양', '#FF0000');
  expect(settings.previewLabelColor).toHaveBeenCalledWith({
    name: '찬양',
    color: '#FF0000',
  });
  expect(catalog.getSnapshot().labels?.value.labels[0]?.color).toBe('#FF0000');
  expect(catalog.getStoredLabels()[0]?.color).toBe('#5FB8C2');
  push(labels(2, ['찬양', '말씀']));
  expect(catalog.getSnapshot().labels?.value.labels[0]?.color).toBe('#5FB8C2');
});

it('changes the 이름표 from the revision it read, and takes one change at a time', async () => {
  let finish: (result: EditResult) => void = () => undefined;
  const {catalog, settings} = setUp(
    undefined,
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await vi.waitFor(() => expect(catalog.getSnapshot().status).toBe('ready'));
  const onApplied = vi.fn();
  const first = catalog.updateLabels(
    [{name: '찬양', color: 'none'}],
    onApplied,
  );
  expect(catalog.getSnapshot().busy).toBe(true);
  await expect(
    catalog.updateLabels([{name: '다른', color: 'none'}]),
  ).resolves.toBe(false);
  await vi.waitFor(() => expect(settings.edit).toHaveBeenCalledOnce());
  expect(settings.edit).toHaveBeenCalledWith(
    expect.objectContaining({type: 'settings.update', baseRevision: 1}),
  );
  finish(applied(2));
  await expect(first).resolves.toBe(true);
  expect(onApplied).toHaveBeenCalledWith(2);
  expect(catalog.getSnapshot().busy).toBe(false);
  expect(names(catalog)).toEqual(['찬양']);
});

it('tells the slides of a rename, and keeps one that was applied but not written for a later retry', async () => {
  const {catalog, notices, saveRetry} = setUp(undefined, async () => ({
    ok: false,
    error: {
      reason: 'write-failed',
      message: 'disk full',
      applied: {id: 'labels', revision: 2},
      unchangedFiles: ['labels.json'],
    },
  }));
  await vi.waitFor(() => expect(catalog.getSnapshot().status).toBe('ready'));
  const renamed = vi.fn();
  catalog.onRenamed(renamed);
  const onApplied = vi.fn();
  await expect(catalog.renameLabel('찬양', '경배', onApplied)).resolves.toBe(
    false,
  );
  expect(renamed).toHaveBeenCalledWith('찬양', '경배');
  expect(onApplied).toHaveBeenCalledWith({name: '경배', revision: 2});
  expect(notices.map(notice => notice.title)).toEqual([
    '이름표 파일 저장 실패',
  ]);

  await expect(
    catalog.retryRename({name: '없는 이름표', revision: 2}),
  ).resolves.toBe(false);
  await expect(catalog.retryRename({name: '경배', revision: 9})).resolves.toBe(
    false,
  );
  await expect(catalog.retryRename({name: '경배', revision: 2})).resolves.toBe(
    true,
  );
  expect(saveRetry).toHaveBeenCalledWith({type: 'saves.retry'});
});

it('renames a 이름표 to its own name only when it has it, and says why a change was refused', async () => {
  const {catalog, settings, notices} = setUp(undefined, async () => ({
    ok: false,
    error: {reason: 'stale', message: 'newer file'},
  }));
  await vi.waitFor(() => expect(catalog.getSnapshot().status).toBe('ready'));
  await expect(catalog.renameLabel('찬양', '찬양')).resolves.toBe(true);
  await expect(catalog.renameLabel('없는', '없는')).resolves.toBe(false);
  expect(settings.edit).not.toHaveBeenCalled();
  await expect(
    catalog.updateLabels([{name: '찬양', color: 'none'}]),
  ).resolves.toBe(false);
  expect(notices.map(notice => notice.title)).toEqual(['이름표 변경 실패']);
});

it('changes nothing in a file a newer app wrote', async () => {
  const readOnly = settingsDocument('labels', {labels: []}, 1);
  const {catalog, settings} = setUp({...readOnly, access: 'readOnly'});
  await vi.waitFor(() => expect(catalog.getSnapshot().status).toBe('ready'));
  await expect(catalog.updateLabels([])).resolves.toBe(false);
  expect(settings.edit).not.toHaveBeenCalled();
});
