import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {TemplateEntry} from '@core/schema/contentDocuments';
import {createServiceId, createTemplateId} from '@core/schema/ids';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {applyService} from '@renderer/session/show';
import {sampleService} from '@renderer/session/testing/sampleService';
import type {Notice} from '@renderer/ui/notices';
import {useServiceActions} from './useServiceActions';
import {librarySongs, templateDocument} from '@core/testing/serviceList';

const currentId = createServiceId('40000000-0000-4000-8000-000000000009');
const savedId = createTemplateId('30000000-0000-4000-8000-000000000008');
const existing: TemplateEntry = {
  id: createTemplateId('30000000-0000-4000-8000-000000000007'),
  name: '이번 주일 예배',
  access: 'editable',
};
const second: TemplateEntry = {
  id: createTemplateId('30000000-0000-4000-8000-000000000006'),
  name: '이번 주일 예배 2',
  access: 'editable',
};
const REFUSED: EditResult = {
  ok: false,
  error: {reason: 'invalid', message: 'Refused in the test'},
};

function Actions({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const actions = useServiceActions({onProblem, onOpen: () => undefined});
  return (
    <>
      {Object.values(actions.entries).map(entry => (
        <button
          key={entry.id}
          type="button"
          disabled={entry.disabled}
          onClick={entry.onSelect}
        >
          {entry.label}
        </button>
      ))}
      {actions.dialogs}
    </>
  );
}

function setup({
  templates = [],
  answer = edit => ({
    ok: true,
    value: {
      id: edit.type === 'template.delete' ? existing.id : savedId,
      revision: edit.type === 'template.delete' ? null : 1,
    },
  }),
}: {
  readonly templates?: readonly TemplateEntry[] | Error;
  readonly answer?: (edit: ContentEdit) => EditResult | Error;
} = {}) {
  const edits: ContentEdit[] = [];
  let push: (entries: readonly TemplateEntry[]) => void = () => undefined;
  window.llp = mockLlpApi({
    templates: {
      list: () =>
        templates instanceof Error
          ? Promise.reject(templates)
          : Promise.resolve(templates),
      get: () => Promise.resolve(templateDocument),
      subscribeList: listener => {
        push = listener;
        return () => undefined;
      },
    },
    songs: {list: () => Promise.resolve(librarySongs)},
    content: {
      edit: edit => {
        edits.push(edit);
        const result = answer(edit);
        return result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result);
      },
    },
  });
  const onProblem = vi.fn();
  render(<Actions onProblem={onProblem} />);
  return {
    edits,
    onProblem,
    push: (entries: readonly TemplateEntry[]) => push(entries),
  };
}

function saveButton(): HTMLElement {
  return screen.getByRole('button', {name: '지금 예배를 템플릿으로 저장'});
}

async function confirmName(): Promise<void> {
  const dialog = await screen.findByRole('dialog', {name: '템플릿으로 저장'});
  await userEvent.click(within(dialog).getByRole('button', {name: '저장'}));
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  applyService(null);
  applyService({...sampleService, id: currentId, name: existing.name});
});

afterEach(() => {
  delete window.llp;
});

describe('지금 예배를 템플릿으로 저장', () => {
  it('cancels the name dialog without saving or reporting success', async () => {
    const {edits, onProblem} = setup();
    await userEvent.click(saveButton());
    await userEvent.click(
      within(screen.getByRole('dialog', {name: '템플릿으로 저장'})).getByRole(
        'button',
        {name: '취소'},
      ),
    );
    expect(edits).toEqual([]);
    expect(onProblem).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prefills a template name dialog and reports the saved name', async () => {
    const {edits, onProblem} = setup();
    await userEvent.click(saveButton());
    const dialog = await screen.findByRole('dialog', {name: '템플릿으로 저장'});
    const name = within(dialog).getByRole('textbox', {name: '이름'});
    expect(name).toHaveProperty('value', existing.name);
    expect(edits).toEqual([]);
    await userEvent.clear(name);
    await userEvent.type(name, '새 템플릿 이름');
    await userEvent.click(within(dialog).getByRole('button', {name: '저장'}));
    await waitFor(() => expect(edits).toHaveLength(1));
    await waitFor(() =>
      expect(saveButton().hasAttribute('disabled')).toBe(false),
    );
    expect(edits).toEqual([
      {
        type: 'service.saveAsTemplate',
        serviceId: currentId,
        name: '새 템플릿 이름',
      },
    ]);
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'info',
        title: '템플릿으로 저장함: 새 템플릿 이름',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks when a 템플릿 has the name, and saves a new one with the next free name', async () => {
    const {edits, onProblem} = setup({templates: [existing, second]});
    await userEvent.click(saveButton());
    await confirmName();
    const prompt = await screen.findByRole('alertdialog', {
      name: '‘이번 주일 예배’ 템플릿이 이미 있습니다. 덮어쓸까요?',
    });
    expect(prompt).toBeDefined();
    await userEvent.click(
      screen.getByRole('button', {name: '새 템플릿으로 저장'}),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'info',
        title: '템플릿으로 저장함: 이번 주일 예배 3',
      }),
    );
    expect(edits).toEqual([
      {
        type: 'service.saveAsTemplate',
        serviceId: currentId,
        name: '이번 주일 예배 3',
      },
    ]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('overwrites by saving the new 템플릿 first and then deleting the old one', async () => {
    const {edits, onProblem} = setup({templates: [existing]});
    await userEvent.click(saveButton());
    await confirmName();
    await userEvent.click(
      await screen.findByRole('button', {name: '덮어쓰기'}),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(edits).toEqual([
      {
        type: 'service.saveAsTemplate',
        serviceId: currentId,
        name: existing.name,
      },
      {type: 'template.delete', templateId: existing.id},
    ]);
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'info',
        title: `템플릿으로 저장함: ${existing.name}`,
      }),
    );
  });

  it('keeps the old 템플릿 when the new one is only in memory', async () => {
    const {edits, onProblem} = setup({
      templates: [existing],
      answer: () => ({
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Disk full in the test',
          applied: {id: savedId, revision: 1},
          unchangedFiles: ['saved.llservice'],
        },
      }),
    });
    await userEvent.click(saveButton());
    await confirmName();
    await userEvent.click(
      await screen.findByRole('button', {name: '덮어쓰기'}),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(edits.map(edit => edit.type)).toEqual(['service.saveAsTemplate']);
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: '템플릿으로 저장할 수 없음',
      }),
    );
  });

  it('sends nothing when the operator cancels', async () => {
    const {edits, onProblem} = setup({templates: [existing]});
    await userEvent.click(saveButton());
    await confirmName();
    await userEvent.click(await screen.findByRole('button', {name: '취소'}));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(edits).toEqual([]);
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('reports a refused save', async () => {
    const refused = setup({answer: () => REFUSED});
    await userEvent.click(saveButton());
    await confirmName();
    await waitFor(() => expect(refused.onProblem).toHaveBeenCalled());
    expect(refused.onProblem.mock.calls[0]?.[0]).toMatchObject({
      kind: 'warning',
      title: '템플릿으로 저장할 수 없음',
    });
  });

  it('reports a list it can not read without saving', async () => {
    const {edits, onProblem} = setup({templates: new Error('Read failed')});
    await userEvent.click(saveButton());
    await confirmName();
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(edits).toEqual([]);
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '템플릿으로 저장할 수 없음',
    });
  });

  it('reports an old 템플릿 it could not delete after overwriting', async () => {
    const {edits, onProblem} = setup({
      templates: [existing],
      answer: edit =>
        edit.type === 'template.delete'
          ? new Error('Delete failed')
          : {ok: true, value: {id: savedId, revision: 1}},
    });
    await userEvent.click(saveButton());
    await confirmName();
    await userEvent.click(
      await screen.findByRole('button', {name: '덮어쓰기'}),
    );
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(edits).toHaveLength(2);
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '기존 템플릿을 지울 수 없음',
    });
  });

  it('saves from the 새 예배 dialog, and the new 템플릿 shows in its list', async () => {
    const {edits, push} = setup();
    await userEvent.click(screen.getByRole('button', {name: '새 예배'}));
    const dialog = await screen.findByRole('dialog', {name: '새 예배'});
    await userEvent.click(
      within(dialog).getByRole('button', {name: '지금 예배를 템플릿으로 저장'}),
    );
    await confirmName();
    await waitFor(() => expect(edits).toHaveLength(1));
    act(() => push([{...existing, id: savedId}]));
    expect(
      await within(dialog).findByRole('option', {name: /이번 주일 예배/}),
    ).toBeDefined();
  });

  it('is unavailable with no open service', () => {
    setup();
    act(() => applyService(null));
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });
});
