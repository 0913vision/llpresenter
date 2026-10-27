import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
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
import type {LiveCommand} from '@shared/commands';
import type {
  ServiceEntry,
  TemplateDocument,
  TemplateEntry,
} from '@shared/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@shared/schema/contentEdit';
import {createServiceId, createTemplateId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {applyService} from '@renderer/state/show';
import {sampleService} from '@renderer/show/testing/sampleService';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {ImportItemsDialog} from './ImportItemsDialog';
import {
  ids,
  legacyTemplateDocument,
  librarySongs,
  pastDocument,
  serviceEntries,
  templateDocument,
  templateEntries,
  titles,
} from './testing';

const currentId = createServiceId('40000000-0000-4000-8000-000000000009');
const current: ServiceEntry = {
  id: currentId,
  name: '이번 주일 예배',
  date: '2026-11-01T11:00',
  access: 'editable',
};
const REFUSED: EditResult = {
  ok: false,
  error: {reason: 'invalid', message: 'Refused in the test'},
};
const ACCEPTED: EditResult = {ok: true, value: {id: currentId, revision: 2}};

function setup({
  answer = () => ACCEPTED,
  templates = templateEntries,
  services = [...serviceEntries, current],
  sourceTemplate = templateDocument,
}: {
  readonly answer?: (edit: ContentEdit) => EditResult | Error;
  readonly templates?: typeof templateEntries;
  readonly services?: readonly ServiceEntry[];
  readonly sourceTemplate?: TemplateDocument;
} = {}) {
  const edits: ContentEdit[] = [];
  const sent: LiveCommand[] = [];
  let pushTemplates: (entries: readonly TemplateEntry[]) => void = () =>
    undefined;
  window.llp = fakeLlpApi({
    templates: {
      list: () => Promise.resolve(templates),
      get: () => Promise.resolve(sourceTemplate),
      subscribeList: listener => {
        pushTemplates = listener;
        return () => undefined;
      },
    },
    services: {
      list: () => Promise.resolve(services),
      get: () => Promise.resolve(pastDocument),
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
    live: {send: command => sent.push(command)},
  });
  const onClose = vi.fn();
  const onProblem = vi.fn();
  render(<ImportItemsDialog onClose={onClose} onProblem={onProblem} />);
  return {
    api: window.llp,
    edits,
    sent,
    onClose,
    onProblem,
    pushTemplates: (entries: readonly TemplateEntry[]) =>
      pushTemplates(entries),
  };
}

function row(name: string): HTMLElement {
  return screen.getByRole('treeitem', {name});
}

function importButton(): HTMLElement {
  return screen.getByRole('button', {name: '가져오기'});
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  applyService(null);
  applyService({...sampleService, id: currentId, name: current.name});
});

afterEach(() => {
  resetTooltips();
  delete window.llp;
});

describe('ImportItemsDialog', () => {
  it('starts from the first 틀 with nothing checked and leaves out the open service', async () => {
    setup();
    expect(
      (await screen.findByRole('treeitem', {name: titles.first})).getAttribute(
        'aria-checked',
      ),
    ).toBe('false');
    expect(screen.queryByRole('option', {name: '빈 예배'})).toBeNull();
    expect(screen.queryByRole('option', {name: /이번 주일 예배/})).toBeNull();
    expect(screen.getByRole('option', {name: /지난 주일 예배/})).toBeDefined();
    expect(importButton().getAttribute('aria-disabled')).toBe('true');
    const tooltip = await hoverForTooltip(importButton());
    expect(tooltip?.textContent).toBe('항목을 골라야 가져올 수 있습니다');
  });

  it('appends the checked items to the open service without an output command', async () => {
    const {edits, sent, onClose, onProblem} = setup();
    await userEvent.click(await screen.findByRole('treeitem', {name: '광고'}));
    await userEvent.click(row(titles.first));
    await userEvent.click(importButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits).toEqual([
      {
        type: 'service.importItems',
        serviceId: currentId,
        from: {kind: 'template', id: ids.template},
        itemIds: [ids.doxology, ids.closing],
      },
    ]);
    expect(sent).toEqual([]);
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('imports empty sections from a legacy template read without checking their preceding section', async () => {
    const {edits, onClose, sent} = setup({
      sourceTemplate: legacyTemplateDocument(),
    });
    await userEvent.click(
      await screen.findByRole('treeitem', {name: '헌금 찬양'}),
    );
    await userEvent.click(row('광고'));
    expect(row('말씀').getAttribute('aria-checked')).toBe('false');
    await userEvent.click(importButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits).toEqual([
      {
        type: 'service.importItems',
        serviceId: currentId,
        from: {kind: 'template', id: ids.template},
        itemIds: [ids.offering, ids.closing],
      },
    ]);
    expect(sent).toEqual([]);
  });

  it('checks nothing when the operator picks a source, also on a return', async () => {
    const {edits, onClose} = setup();
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.first}),
    );
    await userEvent.click(screen.getByRole('option', {name: /지난 주일 예배/}));
    expect(
      (await screen.findByRole('treeitem', {name: '찬양'})).getAttribute(
        'aria-checked',
      ),
    ).toBe('false');
    await userEvent.click(screen.getByRole('option', {name: /^주일 예배/}));
    expect(
      (await screen.findByRole('treeitem', {name: titles.first})).getAttribute(
        'aria-checked',
      ),
    ).toBe('false');
    await userEvent.click(screen.getByRole('option', {name: /지난 주일 예배/}));
    await userEvent.click(await screen.findByRole('treeitem', {name: '찬양'}));
    await userEvent.click(importButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits[0]).toMatchObject({
      from: {kind: 'service', id: ids.past},
      itemIds: [ids.pastSong],
    });
  });

  it.each(['click', 'boundary'] as const)(
    'keeps checked items when the selected source is selected again by %s',
    async method => {
      const user = userEvent.setup();
      const {edits, onClose} = setup();
      const source = await screen.findByRole('option', {
        name: /지난 주일 예배/,
      });
      await user.click(source);
      const item = await screen.findByRole('treeitem', {name: titles.first});
      await user.click(item);
      expect(item.getAttribute('aria-checked')).toBe('true');
      if (method === 'click') await user.click(source);
      else {
        act(() => source.focus());
        await user.keyboard('{End}{ArrowDown}');
      }
      expect(item.getAttribute('aria-checked')).toBe('true');
      await user.click(importButton());
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(edits[0]).toMatchObject({
        from: {kind: 'service', id: ids.past},
        itemIds: [ids.pastSong],
      });
    },
  );

  it('keeps the default 틀 and checked items when a rename sorts it after another 틀', async () => {
    let selectedTemplate = templateDocument;
    const otherTemplate: TemplateDocument = {
      ...templateDocument,
      template: {
        ...templateDocument.template,
        id: createTemplateId('30000000-0000-4000-8000-000000000002'),
        name: '찬양 예배',
        order: [{id: ids.praise, header: '다른 순서'}],
      },
    };
    const otherEntry: TemplateEntry = {
      id: otherTemplate.template.id,
      name: otherTemplate.template.name,
      access: 'editable',
    };
    const {api, edits, onClose, pushTemplates} = setup({
      templates: [...templateEntries, otherEntry],
    });
    vi.spyOn(api.templates, 'get').mockImplementation(id =>
      Promise.resolve(id === ids.template ? selectedTemplate : otherTemplate),
    );
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.first}),
    );
    await userEvent.click(row('광고'));
    fireEvent.contextMenu(screen.getByRole('option', {name: /^주일 예배/}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '이름 바꾸기'}),
    );
    const field = screen.getByRole('textbox', {name: '이름'});
    await userEvent.clear(field);
    await userEvent.type(field, '하늘 예배');
    await userEvent.click(screen.getByRole('button', {name: '바꾸기'}));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: '이름 바꾸기'})).toBeNull(),
    );
    selectedTemplate = {
      ...templateDocument,
      template: {...templateDocument.template, name: '하늘 예배'},
      revision: 2,
    };
    act(() =>
      pushTemplates([
        otherEntry,
        {id: ids.template, name: '하늘 예배', access: 'editable', itemCount: 3},
      ]),
    );
    expect(
      screen
        .getByRole('option', {name: /^하늘 예배/})
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      (await screen.findByRole('treeitem', {name: titles.first})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(row('광고').getAttribute('aria-checked')).toBe('true');
    expect(row(titles.second).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('treeitem', {name: '다른 순서'})).toBeNull();
    await userEvent.click(importButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(edits.at(-1)).toEqual({
      type: 'service.importItems',
      serviceId: currentId,
      from: {kind: 'template', id: ids.template},
      itemIds: [ids.doxology, ids.closing],
    });
  });

  it('stays open while an import is on its way, then closes', async () => {
    let answer: (result: EditResult) => void = () => undefined;
    const onClose = vi.fn();
    window.llp = fakeLlpApi({
      templates: {
        list: () => Promise.resolve(templateEntries),
        get: () => Promise.resolve(templateDocument),
      },
      services: {list: () => Promise.resolve(serviceEntries)},
      songs: {list: () => Promise.resolve(librarySongs)},
      content: {
        edit: () =>
          new Promise(resolve => {
            answer = resolve;
          }),
      },
    });
    render(<ImportItemsDialog onClose={onClose} onProblem={() => undefined} />);
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.first}),
    );
    await userEvent.click(importButton());
    expect(importButton().getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    await userEvent.click(screen.getByRole('button', {name: '닫기'}));
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      answer(ACCEPTED);
      await Promise.resolve();
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('reports a refused or rejected import and keeps the dialog', async () => {
    let attempt = 0;
    const {edits, onClose, onProblem} = setup({
      answer: () => {
        attempt++;
        return attempt === 1 ? REFUSED : new Error('Import failed in the test');
      },
    });
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.first}),
    );
    await userEvent.click(importButton());
    await waitFor(() => expect(onProblem).toHaveBeenCalledTimes(1));
    await userEvent.click(importButton());
    await waitFor(() => expect(onProblem).toHaveBeenCalledTimes(2));
    expect(edits).toHaveLength(2);
    expect(onProblem.mock.calls[1]?.[0]).toMatchObject({
      title: '항목을 가져올 수 없음',
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps 가져오기 unavailable for a read-only service, with the reason', async () => {
    applyService({...sampleService, id: currentId, readOnly: true});
    setup();
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.first}),
    );
    expect(importButton().getAttribute('aria-disabled')).toBe('true');
    const tooltip = await hoverForTooltip(importButton());
    expect(tooltip?.textContent).toBe(
      '읽기 전용 예배 순서에는 가져올 수 없습니다',
    );
  });

  it('says so when there is nothing to import from', async () => {
    setup({templates: [], services: [current]});
    expect(
      await screen.findByText('가져올 틀이나 예배 순서가 없습니다'),
    ).toBeDefined();
    expect(screen.queryByRole('tree')).toBeNull();
  });
});
