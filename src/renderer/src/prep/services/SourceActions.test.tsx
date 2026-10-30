import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
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
} from '@core/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {createTemplateId} from '@core/schema/ids';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
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
  titles,
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
  otherTemplates: readonly TemplateDocument[] = [],
) {
  const edits: ContentEdit[] = [];
  let template: TemplateDocument = templateDocument;
  let pushTemplates: (entries: readonly TemplateEntry[]) => void = () =>
    undefined;
  let pushServices: (entries: readonly ServiceEntry[]) => void = () =>
    undefined;
  window.llp = fakeLlpApi({
    templates: {
      list: () =>
        Promise.resolve([
          ...templateEntries,
          ...otherTemplates.map(({template: {id, name}, access}) => ({
            id,
            name,
            access,
          })),
        ]),
      get: id =>
        Promise.resolve(
          id === template.template.id
            ? template
            : (otherTemplates.find(({template}) => template.id === id) ?? null),
        ),
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
    api: window.llp,
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
  resetTooltips();
  delete window.llp;
});

describe('the service source menu', () => {
  it.each([
    {kind: 'template', name: /^주일 예배/, reason: '읽기 전용 템플릿'},
    {kind: 'service', name: /^지난 주일 예배/, reason: '읽기 전용 예배 순서'},
  ])(
    'disables read-only $kind commands with a reason',
    async ({kind, name, reason}) => {
      const {edits, pushTemplates, pushServices} = setup();
      await screen.findByRole('option', {name});
      act(() => {
        if (kind === 'template') {
          pushTemplates(
            templateEntries.map(entry => ({...entry, access: 'readOnly'})),
          );
        } else {
          pushServices(
            serviceEntries.map(entry => ({...entry, access: 'readOnly'})),
          );
        }
      });
      await openMenu(name);
      for (const command of within(screen.getByRole('menu')).getAllByRole(
        'menuitem',
      )) {
        expect(command.getAttribute('aria-disabled')).toBe('true');
        expect((await hoverForTooltip(command))?.textContent).toBe(reason);
        fireEvent.click(command);
      }
      expect(edits).toHaveLength(0);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    },
  );

  it.each([
    {name: /^주일 예배/, key: 'ContextMenu'},
    {name: /^주일 예배/, key: 'F10'},
    {name: /^지난 주일 예배/, key: 'ContextMenu'},
    {name: /^지난 주일 예배/, key: 'F10'},
  ])(
    'opens the focused $name source with $key in list-row order',
    async ({name, key}) => {
      const {edits} = setup();
      await waitFor(() =>
        expect(
          screen
            .getByRole('option', {name: /^주일 예배/})
            .getAttribute('aria-selected'),
        ).toBe('true'),
      );
      const opener = await screen.findByRole('option', {name});
      const selected = opener.getAttribute('aria-selected');
      act(() => opener.focus());
      fireEvent.keyDown(opener, {key, shiftKey: key === 'F10'});
      const menu = screen.getByRole('menu');
      expect(
        [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
          row => row.textContent,
        ),
      ).toEqual(['이름 바꾸기', '삭제']);
      expect(menu.querySelector('svg')).toBeNull();
      expect(opener.getAttribute('aria-selected')).toBe(selected);
      expect(edits).toHaveLength(0);
      fireEvent.keyDown(menu, {key: 'Escape'});
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(opener);
    },
  );

  it('renames a 템플릿 with its whole document and revision', async () => {
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

  it('deletes a 템플릿 after asking, and the dialog moves on from it', async () => {
    const {edits, pushTemplates} = setup(() => ({
      ok: true,
      value: {id: ids.template, revision: null},
    }));
    await openMenu(/^주일 예배/);
    await userEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    expect(
      screen.getByRole('alertdialog', {
        name: '‘주일 예배’ 템플릿을 삭제할까요?',
      }),
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

  it('keeps the default 템플릿 and checked items when a rename sorts it after another 템플릿', async () => {
    const otherTemplate: TemplateDocument = {
      ...templateDocument,
      template: {
        ...templateDocument.template,
        id: createTemplateId('30000000-0000-4000-8000-000000000002'),
        name: '찬양 예배',
        order: [{id: ids.praise, header: '다른 순서'}],
      },
    };
    const {changeTemplate, pushTemplates} = setup(undefined, [otherTemplate]);
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
        'value',
        '주일 예배',
      ),
    );
    await userEvent.click(screen.getByRole('treeitem', {name: titles.first}));
    await openMenu(/^주일 예배/);
    await userEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const field = screen.getAllByRole('textbox', {name: '이름'}).at(-1);
    if (field === undefined) throw new Error('No name field');
    await userEvent.clear(field);
    await userEvent.type(field, '하늘 예배');
    await userEvent.click(screen.getByRole('button', {name: '바꾸기'}));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: '이름 바꾸기'})).toBeNull(),
    );
    changeTemplate({
      ...templateDocument,
      template: {...templateDocument.template, name: '하늘 예배'},
      revision: 2,
    });
    act(() =>
      pushTemplates([
        {
          id: otherTemplate.template.id,
          name: otherTemplate.template.name,
          access: 'editable',
        },
        {id: ids.template, name: '하늘 예배', access: 'editable', itemCount: 3},
      ]),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
        'value',
        '하늘 예배',
      ),
    );
    expect(
      screen
        .getByRole('option', {name: /^하늘 예배/})
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByRole('treeitem', {name: '다른 순서'})).toBeNull();
    expect(
      screen
        .getByRole('treeitem', {name: titles.first})
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it.each(['template', 'service'] as const)(
    'waits for a %s rename read and write before finishing the close flush',
    async kind => {
      const {api} = setup();
      await openMenu(kind === 'template' ? /^주일 예배/ : /지난 주일 예배/);
      await userEvent.click(
        screen.getByRole('menuitem', {name: '이름 바꾸기'}),
      );
      const field = screen.getAllByRole('textbox', {name: '이름'}).at(-1);
      if (field === undefined) throw new Error('No name field');
      await userEvent.type(field, ' 2');
      let answerRead: () => void = () => undefined;
      const reading = new Promise<void>(resolve => {
        answerRead = resolve;
      });
      if (kind === 'template') {
        vi.spyOn(api.templates, 'get').mockImplementationOnce(() =>
          reading.then(() => templateDocument),
        );
      } else {
        vi.spyOn(api.services, 'get').mockImplementationOnce(() =>
          reading.then(() => pastDocument),
        );
      }
      let answerEdit: (result: EditResult) => void = () => undefined;
      const edit = vi.spyOn(api.content, 'edit').mockImplementationOnce(
        () =>
          new Promise(resolve => {
            answerEdit = resolve;
          }),
      );
      await userEvent.click(screen.getByRole('button', {name: '바꾸기'}));
      const flushed = vi.fn();
      const flushing = pendingWritesOf(api).flush().then(flushed);
      await act(async () => {
        await Promise.resolve();
      });
      expect(flushed).not.toHaveBeenCalled();
      expect(edit).not.toHaveBeenCalled();
      await act(async () => {
        answerRead();
      });
      expect(edit).toHaveBeenCalledOnce();
      expect(edit.mock.calls[0]?.[0].type).toBe(`${kind}.update`);
      expect(flushed).not.toHaveBeenCalled();
      await act(async () => {
        answerEdit({
          ok: true,
          value: {
            id: kind === 'template' ? ids.template : ids.past,
            revision: 2,
          },
        });
        await flushing;
      });
      expect(flushed).toHaveBeenCalledExactlyOnceWith(true);
    },
  );

  it.each(['template', 'service'] as const)(
    'refuses a %s rename before reading when the close flush has stopped writes',
    async kind => {
      const {api, edits, onProblem} = setup();
      await openMenu(kind === 'template' ? /^주일 예배/ : /지난 주일 예배/);
      await userEvent.click(
        screen.getByRole('menuitem', {name: '이름 바꾸기'}),
      );
      const field = screen.getAllByRole('textbox', {name: '이름'}).at(-1);
      if (field === undefined) throw new Error('No name field');
      await userEvent.type(field, ' 2');
      const readTemplate = vi.spyOn(api.templates, 'get');
      const readService = vi.spyOn(api.services, 'get');
      expect(await pendingWritesOf(api).flush()).toBe(true);
      await userEvent.click(screen.getByRole('button', {name: '바꾸기'}));
      await waitFor(() => expect(onProblem).toHaveBeenCalled());
      expect(readTemplate).not.toHaveBeenCalled();
      expect(readService).not.toHaveBeenCalled();
      expect(edits).toEqual([]);
      expect(screen.getByRole('dialog', {name: '이름 바꾸기'})).toBeDefined();
    },
  );

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
