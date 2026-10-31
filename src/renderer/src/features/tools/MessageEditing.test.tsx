import {settingsDocument} from '@core/testing/settingsDocument';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import {CAPTIONS_ID} from '@core/testing/screenDocuments';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {deferred} from './testing/quickTesting';
import {stageFixture} from './stageTesting';
import {MessageTab} from './MessageTab';
import {renderedToolMenuRows} from './toolMenuTesting';
import {
  MAX_MESSAGE_TEMPLATES,
  newMessageTemplate,
  saveMessageEdit,
} from './messageEdits';

const stored = {
  id: '00000000-0000-4000-8000-000000000021',
  name: '차량 이동',
  icon: 'user',
  text: '{번호} 이동 부탁드립니다',
  targets: [CAPTIONS_ID],
  duration: 45,
  future: {keep: true},
};
const newId = '00000000-0000-4000-8000-000000000022';
function messageDocument(
  templates: readonly object[] = [stored],
  revision = 1,
) {
  const document = settingsDocument(
    'messages',
    {templates, stagePresets: ['마무리'], future: {root: true}},
    revision,
  );
  if (document.name !== 'messages') throw new Error('Invalid message fixture');
  return document;
}
function setup() {
  const fixture = stageFixture();
  let document = messageDocument();
  fixture.documents.set('messages', document);
  const api = window.llp;
  const item = document.value.templates[0];
  if (!api || !item) throw new Error('Missing fixture');
  fixture.edit.mockImplementation(edit => {
    if (edit.name !== 'messages') {
      throw new Error('Unexpected edit');
    }
    document = {
      ...document,
      revision: document.revision + 1,
      value: edit.value,
    };
    act(() => fixture.push(document));
    return Promise.resolve({
      ok: true,
      value: {id: 'messages', revision: document.revision},
    });
  });
  return {...fixture, api, item, current: () => document, problem: vi.fn()};
}
const button = (name: string): HTMLElement =>
  screen.getByRole('button', {name});
const fill = (name: string, value: string): void => {
  fireEvent.change(screen.getByRole('textbox', {name}), {target: {value}});
};
async function openRow(action: string): Promise<void> {
  fireEvent.contextMenu(await screen.findByRole('option', {name: '차량 이동'}));
  fireEvent.click(screen.getByRole('menuitem', {name: action}));
}
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(newId);
});
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

it.each([false, true])(
  'lists message-template rows in order when locked=%s',
  async locked => {
    const fixture = setup();
    if (locked) {
      fixture.documents.set('messages', {
        ...fixture.current(),
        access: 'readOnly',
      });
    }
    render(<MessageTab />);
    fireEvent.contextMenu(
      await screen.findByRole('option', {name: '차량 이동'}),
    );
    expect(
      renderedToolMenuRows(screen.getByRole('menu', {name: '메시지 템플릿'})),
    ).toEqual(['수정…', '|', '복제', '이름 바꾸기', '|', '삭제']);
    if (locked) {
      for (const row of screen.getAllByRole('menuitem')) {
        expect(row.getAttribute('aria-disabled')).toBe('true');
        fireEvent.click(row);
      }
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(fixture.edit).not.toHaveBeenCalled();
    }
  },
);

it('adds a validated template, selects it, and leaves sends and presets alone', async () => {
  const fixture = setup();
  render(<MessageTab />);
  await screen.findByRole('option', {name: '차량 이동'});
  fireEvent.click(button('메시지 템플릿 추가'));
  expect(button('추가').getAttribute('aria-disabled')).toBe('true');
  fill('이름', '  새 안내  ');
  fill('문장', '  ');
  expect(
    screen.getByRole('textbox', {name: '문장'}).getAttribute('aria-invalid'),
  ).toBe('true');
  fill('문장', '{이름} 안내석으로 와 주세요');
  fireEvent.click(button('추가'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(
    screen.getByRole('option', {name: '새 안내'}).getAttribute('aria-selected'),
  ).toBe('true');
  expect(fixture.current().value.templates[1]).toEqual({
    id: newId,
    name: '새 안내',
    text: '{이름} 안내석으로 와 주세요',
    icon: 'msg',
  });
  expect(fixture.current().value.stagePresets).toEqual(['마무리']);
  expect(fixture.send).not.toHaveBeenCalled();
});

it('edits only name and sentence, preserving defaults and unknown fields', async () => {
  const fixture = setup();
  render(<MessageTab />);
  await openRow('수정…');
  fill('이름', ' 바뀐 안내 ');
  fill('문장', '{차량} 이동해 주세요');
  fireEvent.click(button('저장'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(fixture.current().value).toEqual(
    expect.objectContaining({future: {root: true}, stagePresets: ['마무리']}),
  );
  expect(fixture.current().value.templates[0]).toEqual({
    ...stored,
    name: '바뀐 안내',
    text: '{차량} 이동해 주세요',
  });
  expect(fixture.send).not.toHaveBeenCalled();
});

it('opens the context menu by keyboard and asks before deleting', async () => {
  const fixture = setup();
  render(<MessageTab />);
  const row = await screen.findByRole('option', {name: '차량 이동'});
  fireEvent.keyDown(row, {key: 'F10', shiftKey: true});
  fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  fireEvent.click(button('취소'));
  expect(fixture.edit).not.toHaveBeenCalled();
  await openRow('삭제');
  fireEvent.click(button('삭제'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(fixture.current().value.templates).toEqual([]);
  expect(fixture.send).not.toHaveBeenCalled();
});

it('keeps an applied addition with a disk warning and prevents duplicate clicks', async () => {
  const fixture = setup();
  const apply = fixture.edit.getMockImplementation();
  if (!apply) throw new Error('Missing edit implementation');
  fixture.edit.mockImplementation(async edit => {
    await apply(edit);
    return {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: {id: 'messages', revision: 2},
        unchangedFiles: ['messages.json'],
      },
    };
  });
  render(<MessageTab onProblem={fixture.problem} />);
  await screen.findByRole('option', {name: '차량 이동'});
  fireEvent.click(button('메시지 템플릿 추가'));
  fill('이름', '새 안내');
  fill('문장', '안내석으로 와 주세요');
  fireEvent.click(button('추가'));
  fireEvent.click(button('추가'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(fixture.edit).toHaveBeenCalledOnce();
  expect(fixture.current().value.templates).toHaveLength(2);
  expect(fixture.problem).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({title: '메시지 템플릿 저장 실패'}),
  );
  expect(await pendingWritesOf(fixture.api).flush()).toBe(true);
});

it('keeps a refused edit open and reports its failure', async () => {
  const fixture = setup();
  fixture.edit.mockResolvedValue({
    ok: false,
    error: {reason: 'saves-full', message: 'Invented refusal'},
  });
  render(<MessageTab onProblem={fixture.problem} />);
  await openRow('수정…');
  fill('이름', '새 이름');
  fireEvent.click(button('저장'));
  await waitFor(() => expect(fixture.problem).toHaveBeenCalledOnce());
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(fixture.current().value.templates[0]).toEqual(stored);
  expect(fixture.log).toHaveBeenCalledOnce();
});

it('finishes an in-flight write after unmount without reporting to the old tab', async () => {
  const fixture = setup();
  const reply = deferred<EditResult>();
  fixture.edit.mockReturnValueOnce(reply.promise);
  const view = render(<MessageTab onProblem={fixture.problem} />);
  await openRow('수정…');
  fill('이름', '새 이름');
  fireEvent.click(button('저장'));
  await waitFor(() => expect(fixture.edit).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => {
    reply.resolve({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented failure',
        applied: {id: 'messages', revision: 2},
        unchangedFiles: ['messages.json'],
      },
    });
  });
  expect(await pendingWritesOf(fixture.api).flush()).toBe(true);
  expect(fixture.count()).toBe(0);
  expect(fixture.problem).not.toHaveBeenCalled();
});

it('keeps the deferred read and write inside the close gate', async () => {
  const fixture = setup();
  const read = deferred<ReturnType<typeof messageDocument>>();
  fixture.get.mockReturnValueOnce(read.promise);
  const editing = saveMessageEdit(fixture.api, {
    kind: 'update',
    id: fixture.item.id,
    fields: {name: '새 이름', text: '안내'},
  });
  const flushed = vi.fn();
  const flush = pendingWritesOf(fixture.api)
    .flush()
    .then(result => {
      flushed(result);
      return result;
    });
  await Promise.resolve();
  expect(flushed).not.toHaveBeenCalled();
  read.resolve(messageDocument());
  await editing;
  expect(await flush).toBe(true);
  expect(fixture.edit).toHaveBeenCalledOnce();
  await expect(
    saveMessageEdit(fixture.api, {kind: 'delete', id: fixture.item.id}),
  ).rejects.toThrow('closing');
  expect(fixture.get).toHaveBeenCalledOnce();
});

it('rebases an edit on the latest document and stops after two stale answers', async () => {
  const fixture = setup();
  const latest = messageDocument(
    [{...stored, duration: 120, future: {keep: 'new'}}],
    8,
  );
  fixture.get
    .mockResolvedValueOnce(messageDocument())
    .mockResolvedValueOnce(latest);
  fixture.edit.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'stale', message: 'Invented race'},
  });
  const fields = {name: '새 이름', text: '안내'};
  await saveMessageEdit(fixture.api, {
    kind: 'update',
    id: fixture.item.id,
    fields,
  });
  expect(fixture.edit.mock.calls[1]?.[0]).toMatchObject({
    baseRevision: 8,
    value: {
      templates: [{...stored, ...fields, duration: 120, future: {keep: 'new'}}],
    },
  });
  fixture.edit.mockClear().mockResolvedValue({
    ok: false,
    error: {reason: 'stale', message: 'Still stale'},
  });
  await expect(
    saveMessageEdit(fixture.api, {kind: 'delete', id: fixture.item.id}),
  ).rejects.toThrow('Still stale');
  expect(fixture.edit).toHaveBeenCalledTimes(2);
});

it('refuses invalid fields, read-only files, missing targets, and additions at the cap', async () => {
  const fixture = setup();
  for (const fields of [
    {name: '', text: '안내'},
    {name: 'x'.repeat(257), text: '안내'},
    {name: '안내', text: ''},
    {name: '안내', text: 'x'.repeat(4001)},
  ]) {
    await expect(
      saveMessageEdit(fixture.api, {
        kind: 'update',
        id: fixture.item.id,
        fields,
      }),
    ).rejects.toThrow('Invalid');
  }
  fixture.get.mockResolvedValueOnce({...messageDocument(), access: 'readOnly'});
  await expect(
    saveMessageEdit(fixture.api, {kind: 'delete', id: fixture.item.id}),
  ).rejects.toThrow('cannot be edited');
  fixture.get.mockResolvedValueOnce(messageDocument([]));
  await expect(
    saveMessageEdit(fixture.api, {
      kind: 'update',
      id: fixture.item.id,
      fields: {name: '안내', text: '안내'},
    }),
  ).rejects.toThrow('no longer exists');
  fixture.get.mockResolvedValueOnce(
    messageDocument(
      Array.from({length: MAX_MESSAGE_TEMPLATES}, (_, i) => ({
        ...stored,
        id: `00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`,
      })),
    ),
  );
  await expect(
    saveMessageEdit(fixture.api, {
      kind: 'add',
      item: newMessageTemplate({name: '안내', text: '안내'}),
    }),
  ).rejects.toThrow('full');
  expect(fixture.edit).not.toHaveBeenCalled();
  await saveMessageEdit(fixture.api, {
    kind: 'update',
    id: fixture.item.id,
    fields: {name: 'x'.repeat(256), text: 'x'.repeat(4000)},
  });
  expect(fixture.edit).toHaveBeenCalledOnce();
});
