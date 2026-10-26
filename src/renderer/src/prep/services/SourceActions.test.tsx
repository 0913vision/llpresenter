import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  ServiceEntry,
  TemplateDocument,
  TemplateEntry,
} from '@shared/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@shared/schema/contentEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {applyService} from '@renderer/state/show';
import {sampleService} from '@renderer/show/testing/sampleService';
import {NewServiceDialog} from './NewServiceDialog';
import {
  ids,
  librarySongs,
  pastDocument,
  serviceEntries,
  templateDocument,
  templateEntries,
} from './testing';

const REFUSED: EditResult = {
  ok: false,
  error: {reason: 'stale', message: 'Changed in the test'},
};

function setup(
  answer: (edit: ContentEdit) => EditResult = () => ({
    ok: true,
    value: {id: ids.template, revision: 2},
  }),
) {
  const edits: ContentEdit[] = [];
  let template: TemplateDocument = templateDocument;
  let pushTemplates: (entries: readonly TemplateEntry[]) => void = () =>
    undefined;
  let pushServices: (entries: readonly ServiceEntry[]) => void = () =>
    undefined;
  window.llp = fakeLlpApi({
    templates: {
      list: () => Promise.resolve(templateEntries),
      get: () => Promise.resolve(template),
      subscribeList: listener => {
        pushTemplates = listener;
        return () => undefined;
      },
    },
    services: {
      list: () => Promise.resolve(serviceEntries),
      get: () => Promise.resolve(pastDocument),
      subscribeList: listener => {
        pushServices = listener;
        return () => undefined;
      },
    },
    songs: {list: () => Promise.resolve(librarySongs)},
    content: {
      edit: edit => {
        edits.push(edit);
        return Promise.resolve(answer(edit));
      },
    },
  });
  const onProblem = vi.fn();
  render(<NewServiceDialog onClose={() => undefined} onProblem={onProblem} />);
  return {
    edits,
    onProblem,
    changeTemplate: (next: TemplateDocument) => {
      template = next;
    },
    pushTemplates: (entries: readonly TemplateEntry[]) =>
      pushTemplates(entries),
    pushServices: (entries: readonly ServiceEntry[]) => pushServices(entries),
  };
}

async function openMenu(name: RegExp): Promise<void> {
  fireEvent.contextMenu(await screen.findByRole('option', {name}));
  await screen.findByRole('menu');
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  applyService(null);
  applyService({...sampleService, id: ids.past, name: '지난 주일 예배'});
});

afterEach(() => {
  delete window.llp;
});

describe('the service source menu', () => {
  it('renames a 틀 with its whole document and revision', async () => {
    const {edits} = setup();
    await openMenu(/^주일 예배/);
    await userEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const field = screen.getAllByRole('textbox', {name: '이름'}).at(-1);
    if (field === undefined) throw new Error('No name field');
    expect(field).toHaveProperty('value', '주일 예배');
    const rename = screen.getByRole('button', {name: '바꾸기'});
    expect(rename.getAttribute('aria-disabled')).toBe('true');
    await userEvent.clear(field);
    await userEvent.type(field, ' 저녁 예배 ');
    await userEvent.click(rename);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: '이름 바꾸기'})).toBeNull(),
    );
    expect(edits).toEqual([
      {
        type: 'template.update',
        template: {...templateDocument.template, name: '저녁 예배'},
        baseRevision: templateDocument.revision,
      },
    ]);
  });

  it('renames a past service the same way', async () => {
    const {edits} = setup();
    await openMenu(/지난 주일 예배/);
    await userEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const field = screen.getAllByRole('textbox', {name: '이름'}).at(-1);
    if (field === undefined) throw new Error('No name field');
    await userEvent.clear(field);
    await userEvent.type(field, '추수감사 예배');
    await userEvent.click(screen.getByRole('button', {name: '바꾸기'}));
    await waitFor(() => expect(edits).toHaveLength(1));
    expect(edits[0]).toEqual({
      type: 'service.update',
      service: {...pastDocument.service, name: '추수감사 예배'},
      baseRevision: pastDocument.revision,
    });
  });

  it('reports a refused rename and keeps the rename dialog', async () => {
    const {onProblem} = setup(() => REFUSED);
    await openMenu(/^주일 예배/);
    await userEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const field = screen.getAllByRole('textbox', {name: '이름'}).at(-1);
    if (field === undefined) throw new Error('No name field');
    await userEvent.type(field, ' 2');
    await userEvent.click(screen.getByRole('button', {name: '바꾸기'}));
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '이름을 바꿀 수 없음',
    });
    expect(screen.getByRole('dialog', {name: '이름 바꾸기'})).toBeDefined();
  });

  it('deletes a 틀 after asking, and the dialog moves on from it', async () => {
    const {edits, pushTemplates} = setup(() => ({
      ok: true,
      value: {id: ids.template, revision: null},
    }));
    await openMenu(/^주일 예배/);
    await userEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    expect(
      screen.getByRole('alertdialog', {name: '‘주일 예배’ 틀을 삭제할까요?'}),
    ).toBeDefined();
    await userEvent.click(screen.getByRole('button', {name: '삭제'}));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(edits).toEqual([
      {type: 'template.delete', templateId: ids.template},
    ]);
    act(() => pushTemplates([]));
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
        'value',
        '새 예배',
      ),
    );
  });

  it("doesn't delete the open service", async () => {
    setup();
    await openMenu(/지난 주일 예배/);
    expect(
      screen
        .getByRole('menuitem', {name: '삭제'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('reads the chosen 틀 again after it is renamed', async () => {
    const {changeTemplate, pushTemplates} = setup();
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
        'value',
        '주일 예배',
      ),
    );
    changeTemplate({
      ...templateDocument,
      template: {...templateDocument.template, name: '저녁 예배'},
      revision: 2,
    });
    act(() =>
      pushTemplates([
        {id: ids.template, name: '저녁 예배', access: 'editable', itemCount: 4},
      ]),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
        'value',
        '저녁 예배',
      ),
    );
  });

  it('keeps the delete prompt until its edit answers', async () => {
    let answer: (result: EditResult) => void = () => undefined;
    setup();
    window.llp = fakeLlpApi({
      ...window.llp,
      content: {
        edit: () =>
          new Promise(resolve => {
            answer = resolve;
          }),
      },
    });
    await openMenu(/^주일 예배/);
    await userEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    await userEvent.click(screen.getByRole('button', {name: '삭제'}));
    const prompt = screen.getByRole('alertdialog');
    await userEvent.click(within(prompt).getByRole('button', {name: '취소'}));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBe(prompt);
    await act(async () => {
      answer({ok: true, value: {id: ids.template, revision: null}});
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});
