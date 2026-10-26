import {act, render, screen, waitFor} from '@testing-library/react';
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
import type {ServiceEntry} from '@shared/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@shared/schema/contentEdit';
import {createServiceId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {applyService} from '@renderer/state/show';
import {sampleService} from '@renderer/show/testing/sampleService';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {ImportItemsDialog} from './ImportItemsDialog';
import {
  ids,
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
}: {
  readonly answer?: (edit: ContentEdit) => EditResult | Error;
  readonly templates?: typeof templateEntries;
  readonly services?: readonly ServiceEntry[];
} = {}) {
  const edits: ContentEdit[] = [];
  const sent: LiveCommand[] = [];
  window.llp = fakeLlpApi({
    templates: {
      list: () => Promise.resolve(templates),
      get: () => Promise.resolve(templateDocument),
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
  return {edits, sent, onClose, onProblem};
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
