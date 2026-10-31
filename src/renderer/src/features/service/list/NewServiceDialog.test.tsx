import {act, render, screen, waitFor, within} from '@testing-library/react';
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
import type {LiveCommand} from '@core/live/commands';
import type {TemplateDocument} from '@core/schema/contentDocuments';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import type {ServiceOpenRequest} from '@core/schema/serviceOpen';
import type {ShowService} from '@core/schema/showService';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {applyService, useShow} from '@renderer/session/show';
import {sampleService} from '@renderer/session/testing/sampleService';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {NewServiceDialog} from './NewServiceDialog';
import {
  ids,
  legacyTemplateDocument,
  librarySongs,
  pastDocument,
  serviceEntries,
  templateDocument,
  templateEntries,
  titles,
} from '@core/testing/serviceList';

const REFUSED: EditResult = {
  ok: false,
  error: {reason: 'invalid', message: 'Refused in the test'},
};

function accepted(edit: ContentEdit): EditResult {
  return {
    ok: true,
    value: {
      id: ids.created,
      revision: edit.type === 'service.delete' ? null : 1,
    },
  };
}

function setup(
  answer: (edit: ContentEdit) => EditResult | Error = accepted,
  sourceTemplate: TemplateDocument = templateDocument,
) {
  const edits: ContentEdit[] = [];
  const sent: LiveCommand[] = [];
  const open = vi.fn(
    ({serviceId}: ServiceOpenRequest): Promise<ShowService | null> =>
      Promise.resolve({
        ...sampleService,
        id: serviceId,
        name: '새로 만든 예배',
      }),
  );
  window.llp = mockLlpApi({
    templates: {
      list: () => Promise.resolve(templateEntries),
      get: () => Promise.resolve(sourceTemplate),
    },
    services: {
      list: () => Promise.resolve(serviceEntries),
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
    service: {open},
    live: {send: command => sent.push(command)},
  });
  const onClose = vi.fn();
  const onProblem = vi.fn();
  render(<NewServiceDialog onClose={onClose} onProblem={onProblem} />);
  return {edits, sent, open, onClose, onProblem};
}

function row(name: string): HTMLElement {
  return screen.getByRole('treeitem', {name});
}

function createButton(): HTMLElement {
  return screen.getByRole('button', {name: '만들기'});
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.useFakeTimers({toFake: ['Date'], now: new Date(2026, 9, 26, 8, 40)});
  applyService(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetTooltips();
  vi.useRealTimers();
  delete window.llp;
});

describe('NewServiceDialog', () => {
  it('refreshes today across midnight without resetting the chosen date', async () => {
    vi.setSystemTime(new Date(2026, 9, 26, 23, 59));
    const {edits, onClose} = setup();
    const user = userEvent.setup();
    await screen.findByRole('treeitem', {name: titles.first});
    const date = screen.getByRole('button', {name: '날짜'});
    await user.click(date);
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{Enter}');
    expect(date.textContent).toBe('10월 29일 목요일');
    vi.setSystemTime(new Date(2026, 9, 27, 0, 1));
    await user.click(date);
    expect(date.textContent).toBe('10월 29일 목요일');
    expect(
      screen
        .getByRole('button', {name: '2026년 10월 27일 화요일'})
        .getAttribute('aria-current'),
    ).toBe('date');
    await user.click(screen.getByRole('button', {name: '오늘'}));
    expect(date.textContent).toBe('10월 27일 화요일');
    await user.click(date);
    vi.setSystemTime(new Date(2026, 9, 28, 0, 1));
    await user.click(screen.getByRole('button', {name: '오늘'}));
    expect(date.textContent).toBe('10월 28일 수요일');
    expect(edits).toHaveLength(0);
    await user.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(edits[0]).toMatchObject({
      type: 'service.create',
      date: '2026-10-28T11:00',
    });
  });

  it('chooses a date beyond the old two-week list without submitting the parent', async () => {
    const {edits, onClose} = setup();
    const user = userEvent.setup();
    await screen.findByRole('treeitem', {name: titles.first});
    const date = screen.getByRole('button', {name: '날짜'});
    await user.click(date);
    await user.keyboard('{PageDown}{ArrowRight}{Enter}');
    expect(date.textContent).toBe('11월 27일 금요일');
    expect(document.activeElement).toBe(date);
    expect(onClose).not.toHaveBeenCalled();
    expect(edits).toHaveLength(0);
    await user.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(edits.filter(edit => edit.type === 'service.create')).toHaveLength(
      1,
    );
    expect(edits[0]).toMatchObject({
      type: 'service.create',
      date: '2026-11-27T11:00',
    });
  });

  it('starts from the first 템플릿 with every item checked and its name and time', async () => {
    setup();
    expect(
      await screen.findByRole('treeitem', {name: titles.first}),
    ).toBeDefined();
    expect(
      screen
        .getByRole('checkbox', {name: '예배 순서'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(row('찬양').getAttribute('aria-checked')).toBe('true');
    expect(
      within(screen.getByRole('region', {name: '예배 순서'})).getByText(
        '항목 3개',
      ),
    ).toBeDefined();
    expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
      'value',
      '주일 예배',
    );
    expect(screen.getByRole('button', {name: '날짜'}).textContent).toBe(
      '10월 26일 월요일',
    );
    expect(screen.getByRole('button', {name: '시간'}).textContent).toBe(
      '오전 11:00',
    );
    expect(screen.getByRole('option', {name: /빈 예배/})).toBeDefined();
    expect(
      screen.getByRole('option', {name: /지난 주일 예배/}).textContent,
    ).toContain('10월 25일 일요일');
  });

  it('creates from the 템플릿 with the checked items and opens it without an output command', async () => {
    const {edits, sent, open, onClose, onProblem} = setup();
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.second}),
    );
    expect(row('찬양').getAttribute('aria-checked')).toBe('mixed');
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits).toEqual([
      {
        type: 'service.create',
        name: '주일 예배',
        date: '2026-10-26T11:00',
        templateId: null,
      },
      {
        type: 'service.importItems',
        serviceId: ids.created,
        from: {kind: 'template', id: ids.template},
        itemIds: [ids.doxology, ids.psalm, ids.offering, ids.closing],
      },
    ]);
    expect(open).toHaveBeenCalledWith({serviceId: ids.created});
    expect(useShow.getState().serviceId).toBe(ids.created);
    expect(sent).toEqual([]);
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('creates with only the checked empty sections from a legacy template read', async () => {
    const {edits, onClose} = setup(accepted, legacyTemplateDocument());
    await screen.findByRole('treeitem', {name: '헌금 찬양'});
    await userEvent.click(screen.getByRole('checkbox', {name: '예배 순서'}));
    await userEvent.click(row('헌금 찬양'));
    await userEvent.click(row('광고'));
    expect(row('말씀').getAttribute('aria-checked')).toBe('false');
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits[1]).toEqual({
      type: 'service.importItems',
      serviceId: ids.created,
      from: {kind: 'template', id: ids.template},
      itemIds: [ids.offering, ids.closing],
    });
  });

  it('stays open while a create is on its way, then closes', async () => {
    let answer: (result: EditResult) => void = () => undefined;
    const onClose = vi.fn();
    window.llp = mockLlpApi({
      templates: {
        list: () => Promise.resolve(templateEntries),
        get: () => Promise.resolve(templateDocument),
      },
      services: {list: () => Promise.resolve(serviceEntries)},
      songs: {list: () => Promise.resolve(librarySongs)},
      content: {
        edit: edit =>
          edit.type === 'service.create'
            ? new Promise(resolve => {
                answer = resolve;
              })
            : Promise.resolve(accepted(edit)),
      },
      service: {
        open: ({serviceId}) =>
          Promise.resolve({...sampleService, id: serviceId}),
      },
    });
    render(<NewServiceDialog onClose={onClose} onProblem={() => undefined} />);
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      answer(
        accepted({
          type: 'service.create',
          name: '',
          date: '',
          templateId: null,
        }),
      );
      await Promise.resolve();
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(useShow.getState().serviceId).toBe(ids.created);
  });

  it('keeps 만들기 unavailable while the name is empty, with the reason', async () => {
    const {edits} = setup();
    const name = screen.getByRole('textbox', {name: '이름'});
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.clear(name);
    await userEvent.type(name, '   ');
    expect(createButton().getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(createButton());
    await userEvent.keyboard('{Enter}');
    expect(edits).toEqual([]);
    const tooltip = await hoverForTooltip(createButton());
    expect(tooltip?.textContent).toBe('이름을 적어야 만들 수 있습니다');
  });

  it('creates an empty service from 빈 예배 with the current hour', async () => {
    const {edits, onClose} = setup();
    await userEvent.click(await screen.findByRole('option', {name: /빈 예배/}));
    expect(screen.getByRole('textbox', {name: '이름'})).toHaveProperty(
      'value',
      '새 예배',
    );
    expect(screen.queryByRole('checkbox', {name: '예배 순서'})).toBeNull();
    expect(screen.getByRole('button', {name: '시간'}).textContent).toBe(
      '오전 8:00',
    );
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits).toEqual([
      {
        type: 'service.create',
        name: '새 예배',
        date: '2026-10-26T08:00',
        templateId: null,
      },
    ]);
  });

  it('starts from a past service with its items checked and its time', async () => {
    const {edits, onClose} = setup();
    await userEvent.click(
      await screen.findByRole('option', {name: /지난 주일 예배/}),
    );
    expect(
      (await screen.findByRole('treeitem', {name: titles.first})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(screen.getByRole('button', {name: '시간'}).textContent).toBe(
      '오전 9:30',
    );
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits[1]).toEqual({
      type: 'service.importItems',
      serviceId: ids.created,
      from: {kind: 'service', id: ids.past},
      itemIds: [ids.pastSong],
    });
  });

  it('keeps a typed name when the operator picks another source', async () => {
    setup();
    const name = screen.getByRole('textbox', {name: '이름'});
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.clear(name);
    await userEvent.type(name, '추수감사 예배');
    await userEvent.click(screen.getByRole('option', {name: /빈 예배/}));
    expect(name).toHaveProperty('value', '추수감사 예배');
  });

  it('deletes the new service again when its items can not be copied', async () => {
    const {edits, onClose, onProblem} = setup(edit =>
      edit.type === 'service.importItems' ? REFUSED : accepted(edit),
    );
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(edits.map(edit => edit.type)).toEqual([
      'service.create',
      'service.importItems',
      'service.delete',
    ]);
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '새 예배를 만들 수 없음',
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(createButton().getAttribute('aria-disabled')).toBeNull();
  });

  it('reports a refused create and keeps the dialog', async () => {
    const {edits, open, onClose, onProblem} = setup(() => REFUSED);
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(edits).toHaveLength(1);
    expect(open).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('goes on when the new file waits to be saved', async () => {
    const {open, onClose} = setup(() => ({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk full in the test',
        applied: {id: ids.created, revision: 1},
        unchangedFiles: ['service.llservice'],
      },
    }));
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith({serviceId: ids.created});
  });

  it('closes and reports when the new service can not be opened', async () => {
    const {open, onClose, onProblem} = setup();
    open.mockResolvedValueOnce(null);
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '새 예배를 열 수 없음',
    });
    expect(useShow.getState().serviceId).toBeNull();
  });

  it('checks every item again when the operator returns to a source', async () => {
    setup();
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.second}),
    );
    expect(row(titles.second).getAttribute('aria-checked')).toBe('false');
    await userEvent.click(screen.getByRole('option', {name: '빈 예배'}));
    await userEvent.click(screen.getByRole('option', {name: /^주일 예배/}));
    expect(
      (await screen.findByRole('treeitem', {name: titles.second})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
  });

  it.each(['click', 'boundary'] as const)(
    'keeps exclusions when the selected source is selected again by %s',
    async method => {
      const user = userEvent.setup();
      const {edits, onClose} = setup();
      const source = await screen.findByRole('option', {
        name: /지난 주일 예배/,
      });
      await user.click(source);
      const item = await screen.findByRole('treeitem', {name: titles.first});
      await user.click(item);
      expect(item.getAttribute('aria-checked')).toBe('false');
      if (method === 'click') await user.click(source);
      else {
        act(() => source.focus());
        await user.keyboard('{End}{ArrowDown}');
      }
      expect(item.getAttribute('aria-checked')).toBe('false');
      await user.click(createButton());
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(edits.some(edit => edit.type === 'service.importItems')).toBe(
        false,
      );
    },
  );

  it('deletes the new service again when copying its items is rejected', async () => {
    const {edits, open, onClose, onProblem} = setup(edit =>
      edit.type === 'service.importItems'
        ? new Error('Copy failed in the test')
        : accepted(edit),
    );
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(edits.map(edit => edit.type)).toEqual([
      'service.create',
      'service.importItems',
      'service.delete',
    ]);
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '새 예배를 만들 수 없음',
    });
    expect(open).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens the empty new service and closes when it can not be deleted either', async () => {
    const {edits, open, onClose, onProblem} = setup(edit =>
      edit.type === 'service.create'
        ? accepted(edit)
        : edit.type === 'service.importItems'
          ? REFUSED
          : new Error('Delete failed in the test'),
    );
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits).toHaveLength(3);
    expect(open).toHaveBeenCalledWith({serviceId: ids.created});
    expect(useShow.getState().serviceId).toBe(ids.created);
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '새 예배에 항목을 가져올 수 없음',
    });
  });

  it('closes, without making it twice, when opening the new service is rejected', async () => {
    const {edits, open, onClose, onProblem} = setup();
    open.mockRejectedValueOnce(new Error('Open failed in the test'));
    await screen.findByRole('treeitem', {name: titles.first});
    await userEvent.click(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(edits.map(edit => edit.type)).toEqual([
      'service.create',
      'service.importItems',
    ]);
    expect(onProblem.mock.calls[0]?.[0]).toMatchObject({
      title: '새 예배를 열 수 없음',
    });
  });

  it('offers 다시 시도 when a list could not be read', async () => {
    const list = vi
      .fn<() => Promise<typeof templateEntries>>()
      .mockRejectedValueOnce(new Error('Read failed in the test'))
      .mockResolvedValue(templateEntries);
    window.llp = mockLlpApi({
      templates: {list, get: () => Promise.resolve(templateDocument)},
      services: {list: () => Promise.resolve(serviceEntries)},
      songs: {list: () => Promise.resolve(librarySongs)},
    });
    render(
      <NewServiceDialog
        onClose={() => undefined}
        onProblem={() => undefined}
      />,
    );
    await userEvent.click(
      await screen.findByRole('button', {name: '다시 시도'}),
    );
    expect(
      await screen.findByRole('option', {name: /^주일 예배/}),
    ).toBeDefined();
    expect(screen.queryByRole('button', {name: '다시 시도'})).toBeNull();
  });
});
