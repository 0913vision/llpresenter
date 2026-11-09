import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import {applyService, openItem, useShow} from '@renderer/session/show';
import {createServiceId} from '@core/schema/ids';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import {isItemOfKind, type Service} from '@core/schema/service';
import {serviceItemClipboardFor} from '@renderer/session/serviceItemClipboard';
import {
  firstId,
  lastId,
  headerId,
  serviceId,
  songId,
  setup,
} from '@fixtures/renderer/features/service/order/serviceOrderEditingFixtures';

afterEach(() => {
  delete window.llp;
});

const selectedIds = (): Array<string | null> =>
  screen
    .getAllByRole('option', {selected: true})
    .map(row => row.getAttribute('data-value'));

describe('service order clipboard commands', () => {
  it('waits for an in-flight copy when paste follows before the source read completes', async () => {
    const {api, document, ids} = setup('prep');
    const user = userEvent.setup();
    let finish: ((value: ServiceDocument) => void) | undefined;
    vi.spyOn(api.services, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await user.click(screen.getByRole('option', {name: '첫 곡'}));
    await user.keyboard('{Control>}c{/Control}');
    await waitFor(() => expect(finish).toBeDefined());
    await user.keyboard('{Control>}v{/Control}');
    expect(api.content.edit).not.toHaveBeenCalled();
    await act(async () => {
      finish?.(document());
    });
    await waitFor(() => expect(ids()).toHaveLength(4));
  });

  it('selects pasted rows after a delayed projection rather than selecting ids that are not visible yet', async () => {
    const {api} = setup('prep');
    const user = userEvent.setup();
    await act(async () => {
      await serviceItemClipboardFor(api).copy(serviceId, new Set([firstId]));
    });
    const saved: {service: Service | null} = {service: null};
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
      if (command.type !== 'service.update') {
        throw new Error('Unexpected command');
      }
      saved.service = command.service;
      return {ok: true, value: {id: serviceId, revision: 2}};
    });
    await user.click(screen.getByRole('option', {name: '첫 곡'}));
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(saved.service).not.toBeNull());
    expect(useShow.getState().openItemId).toBe(firstId);
    expect(selectedIds()).toEqual([firstId]);
    const service = saved.service;
    if (service === null) throw new Error('Missing paste');
    const copy = service.order.find(
      item => ![headerId, firstId, lastId].includes(item.id),
    );
    if (copy === undefined) throw new Error('Missing pasted row');
    act(() =>
      applyService({
        id: serviceId,
        revision: 2,
        name: service.name,
        readOnly: false,
        rows: service.order.map(item =>
          isItemOfKind(item, 'header')
            ? {kind: 'header', id: item.id, title: item.header}
            : {kind: 'song', id: item.id, title: 'Projected song'},
        ),
        tiles: {},
        jumpKeys: {},
      }),
    );
    await waitFor(() => expect(selectedIds()).toEqual([copy.id]));
    expect(useShow.getState().openItemId).toBe(copy.id);
  });

  it('pastes a source service snapshot into an empty other service without changing the source', async () => {
    const {api, view, document: sourceDocument} = setup('show');
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await user.click(await screen.findByRole('menuitem', {name: /^복사/u}));
    await waitFor(() =>
      expect(serviceItemClipboardFor(api).getCount()).toBe(1),
    );
    const source = sourceDocument();
    const destinationId = createServiceId(
      '00000000-0000-4000-8000-000000000002',
    );
    let destination: ServiceDocument = {
      ...source,
      service: {
        ...source.service,
        id: destinationId,
        name: 'Other service',
        order: [],
      },
    };
    const get = api.services.get;
    vi.spyOn(api.services, 'get').mockImplementation(id =>
      id === destinationId ? Promise.resolve(destination) : get(id),
    );
    vi.spyOn(api.content, 'edit').mockImplementation(async command => {
      if (command.type !== 'service.update') {
        throw new Error('Unexpected command');
      }
      destination = {
        ...destination,
        service: command.service,
        revision: destination.revision + 1,
      };
      applyService({
        id: destinationId,
        name: 'Other service',
        revision: destination.revision,
        readOnly: false,
        rows: destination.service.order.map(item => ({
          kind: 'song',
          id: item.id,
          title: 'Pasted song',
        })),
        tiles: {},
        jumpKeys: {},
      });
      return {
        ok: true,
        value: {id: destinationId, revision: destination.revision},
      };
    });
    act(() =>
      applyService({
        id: destinationId,
        name: 'Other service',
        revision: destination.revision,
        readOnly: false,
        rows: [],
        tiles: {},
        jumpKeys: {},
      }),
    );
    view.rerender(<ServiceOrderList workspace="prep" />);
    const list = screen.getByRole('listbox', {name: '예배 순서'});
    list.tabIndex = -1;
    list.focus();
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(destination.service.order).toHaveLength(1));
    expect(destination.service.order[0]).toMatchObject({
      song: songId,
    });
    expect(destination.service.order[0]?.id).not.toBe(firstId);
    expect(sourceDocument()).toBe(source);
    expect(useShow.getState().serviceId).toBe(destinationId);
  });

  it('leaves native copy and paste keys to a row text field', async () => {
    const {api} = setup('prep');
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '제목'}));
    await user.click(
      await screen.findByRole('menuitem', {name: '이름 바꾸기'}),
    );
    const field = await screen.findByRole('textbox');
    for (const [key, code] of [
      ['c', 'KeyC'],
      ['v', 'KeyV'],
    ] as const) {
      const event = new KeyboardEvent('keydown', {
        key,
        code,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(false);
      fireEvent.keyUp(field, {key, code, ctrlKey: true});
    }
    expect(serviceItemClipboardFor(api).getCount()).toBe(0);
    expect(api.content.edit).not.toHaveBeenCalled();
  });

  it.each(['show', 'prep'] as const)(
    'copies a Shift-selected range and pastes it after the cursor in %s as one undo step',
    async workspace => {
      const {api, ids, send, list} = setup(workspace);
      const user = userEvent.setup();
      const first = screen.getByRole('option', {name: '첫 곡'});
      const last = screen.getByRole('option', {name: '다음 곡'});
      await user.click(first);
      fireEvent.click(last, {shiftKey: true});
      expect(selectedIds()).toEqual([firstId, lastId]);
      last.focus();
      await user.keyboard('{Control>}c{/Control}');
      await waitFor(() =>
        expect(serviceItemClipboardFor(api).getCount()).toBe(2),
      );
      await user.keyboard('{Control>}v{/Control}');
      await waitFor(() => expect(ids()).toHaveLength(5));
      expect(ids().slice(0, 3)).toEqual([headerId, firstId, lastId]);
      await waitFor(() => expect(selectedIds()).toEqual(ids().slice(3)));
      expect(api.content.edit).toHaveBeenCalledOnce();
      expect(send).not.toHaveBeenCalled();
      list().querySelector<HTMLElement>('[tabindex="0"]')?.focus();
      await user.keyboard('{Control>}z{/Control}');
      await waitFor(() => expect(ids()).toEqual([headerId, firstId, lastId]));
      await user.keyboard('{Control>}y{/Control}');
      await waitFor(() => expect(ids()).toHaveLength(5));
      expect(api.content.edit).toHaveBeenCalledTimes(3);
    },
  );

  it('toggles individual rows with Ctrl, extends with Shift arrows and collapses with a plain arrow', async () => {
    setup('prep');
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    const header = screen.getByRole('option', {name: '제목'});
    fireEvent.click(header);
    fireEvent.click(last, {ctrlKey: true});
    expect(selectedIds()).toEqual([headerId, lastId]);
    fireEvent.click(last, {ctrlKey: true});
    expect(selectedIds()).toEqual([headerId]);
    fireEvent.click(first);
    first.focus();
    fireEvent.keyDown(first, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      shiftKey: true,
    });
    expect(selectedIds()).toEqual([firstId, lastId]);
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, {key: 'ArrowUp', code: 'ArrowUp'});
    expect(selectedIds()).toEqual([firstId]);
  });

  it('uses the multi-selection from the context menu and the clicked row as its paste anchor', async () => {
    const {api, ids} = setup('prep');
    const user = userEvent.setup();
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    fireEvent.contextMenu(first);
    await user.click(await screen.findByRole('menuitem', {name: /^2개 복사/u}));
    await waitFor(() =>
      expect(serviceItemClipboardFor(api).getCount()).toBe(2),
    );
    fireEvent.contextMenu(first);
    await user.click(await screen.findByRole('menuitem', {name: /^붙여넣기/u}));
    await waitFor(() => expect(ids()).toHaveLength(5));
    expect(ids()[0]).toBe(headerId);
    expect(ids()[1]).toBe(firstId);
    expect(ids()[4]).toBe(lastId);
  });

  it('keeps copied items across workspace mounts and appends with no selection', async () => {
    const {api, view, ids, list} = setup('show');
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    await user.click(await screen.findByRole('menuitem', {name: /^복사/u}));
    await waitFor(() =>
      expect(serviceItemClipboardFor(api).getCount()).toBe(1),
    );
    view.rerender(<ServiceOrderList workspace="prep" />);
    act(() => useShow.setState({openItemId: null}));
    const editTarget = list();
    editTarget.tabIndex = -1;
    editTarget.focus();
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(ids()).toHaveLength(4));
    expect(ids().slice(0, 3)).toEqual([headerId, firstId, lastId]);
    expect(ids()[3]).not.toBe(firstId);
  });

  it('allows copying a read-only source and refuses paste there', async () => {
    const {api, ids} = setup('prep', true);
    const user = userEvent.setup();
    const first = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.contextMenu(first);
    expect(
      screen
        .getByRole('menuitem', {name: /^복사/u})
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
    await user.click(screen.getByRole('menuitem', {name: /^복사/u}));
    await waitFor(() =>
      expect(serviceItemClipboardFor(api).getCount()).toBe(1),
    );
    fireEvent.contextMenu(first);
    expect(
      screen
        .getByRole('menuitem', {name: /^붙여넣기/u})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await user.keyboard('{Escape}');
    first.focus();
    await user.keyboard('{Control>}v{/Control}');
    expect(ids()).toHaveLength(3);
    expect(api.content.edit).not.toHaveBeenCalled();
  });

  it('does not change global selection after the list unmounts during a paste', async () => {
    const {api, view} = setup('prep');
    const user = userEvent.setup();
    await act(async () => {
      await serviceItemClipboardFor(api).copy(serviceId, new Set([firstId]));
    });
    const edit = api.content.edit;
    let finish: (() => void) | undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
      await new Promise<void>(resolve => {
        finish = resolve;
      });
      return edit(command);
    });
    await user.click(screen.getByRole('option', {name: '첫 곡'}));
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(finish).toBeDefined());
    view.unmount();
    await act(async () => {
      finish?.();
    });
    expect(useShow.getState().openItemId).toBe(firstId);
  });

  it('does not replace the current item selection after the operator changes it while a paste saves', async () => {
    const {api, list} = setup('prep');
    const user = userEvent.setup();
    await act(async () => {
      await serviceItemClipboardFor(api).copy(serviceId, new Set([firstId]));
    });
    const original = api.content.edit;
    let finish: (() => void) | undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
      await new Promise<void>(resolve => {
        finish = resolve;
      });
      return original(command);
    });
    fireEvent.click(screen.getByRole('option', {name: '첫 곡'}));
    list().querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(finish).toBeDefined());
    act(() => openItem(lastId));
    await act(async () => {
      finish?.();
    });
    expect(useShow.getState().openItemId).toBe(lastId);
  });
});
