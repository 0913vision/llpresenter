import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {defaultPreferences} from '@core/schema/preferences';
import {createServiceItemId} from '@core/schema/ids';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@renderer/features/service/items/itemFixture';
import {useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {BiblePanel} from '../../presentation/BiblePanel';
import {openBiblePassage} from '../../bible/actions';
import {panelApi, panelPassage} from '@contracts/ipc/testing/bibleApi';

afterEach(() => {
  delete window.llp;
  useShow.setState({
    serviceId: null,
    readOnly: false,
    openItemId: null,
    rows: [],
    tiles: {},
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
  });
});

function setup() {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const history = panelApi();
  const document = fixture.service();
  const changed = parseServiceDocument({
    ...document,
    service: {
      ...document.service,
      order: [
        {id: fixtureItems.header, header: 'First section'},
        {id: fixtureItems.arranged, song: fixture.first.song.id},
        {id: fixtureItems.slot, header: 'Empty section', future: {keep: true}},
        {id: fixtureItems.lost, header: 'Next section'},
        {id: fixtureItems.plain, song: fixture.second.song.id},
      ],
    },
  });
  if (!changed.ok || changed.value === null) {
    throw new Error('Invalid section fixture');
  }
  fixture.pushService(changed.value);
  const api = {...fixture.api, settings: history.api.settings};
  window.llp = api;
  const preferences = vi.spyOn(api.preferences, 'get').mockResolvedValue({
    ...defaultPreferences,
    bible: {...defaultPreferences.bible, verseNumbers: false},
  });
  const output = vi.spyOn(api.live, 'send');
  const serviceRead = vi.spyOn(api.services, 'get');
  const problem = vi.fn();
  useShow.setState({
    serviceId: fixtureServiceId,
    readOnly: false,
    openItemId: fixtureItems.slot,
    rows: [
      {kind: 'header', id: fixtureItems.header, title: 'First section'},
      {kind: 'song', id: fixtureItems.arranged, title: 'Invented song'},
      {kind: 'header', id: fixtureItems.slot, title: 'Empty section'},
      {kind: 'header', id: fixtureItems.lost, title: 'Next section'},
      {kind: 'song', id: fixtureItems.plain, title: 'Other song'},
    ],
  });
  useLive.setState({state: emptyLiveState()});
  openBiblePassage(panelPassage());
  render(<BiblePanel sizeClass="normal" onProblem={problem} />);
  return {
    ...fixture,
    api,
    history,
    preferences,
    serviceRead,
    output,
    problem,
    user: userEvent.setup(),
    button: screen.getByRole('button', {name: '예배 순서에 넣기'}),
  };
}

it('retains the selected empty section through successive previews and remembers only the inserted normalized reference', async () => {
  const view = setup();
  act(() =>
    openBiblePassage({
      ...panelPassage(),
      ref: '요한복음 3:17-18',
      displayRef: '요한복음 3:17-18',
      verses: panelPassage().verses.slice(1),
    }),
  );
  await view.user.click(view.button);
  await waitFor(() => expect(view.service().service.order).toHaveLength(6));
  expect(view.service().service.order[2]).toMatchObject({
    id: fixtureItems.slot,
    header: 'Empty section',
    future: {keep: true},
  });
  expect(view.service().service.order[3]).toMatchObject({
    bible: {
      translation: panelPassage().translation,
      ref: '요한복음 3:17-18',
      verseNumbers: true,
    },
  });
  expect(view.service().service.order[4]?.id).toBe(fixtureItems.lost);
  await waitFor(() =>
    expect(view.history.document().value.recents).toEqual([
      {translation: panelPassage().translation, ref: '요한복음 3:17-18'},
    ]),
  );
  expect(view.output).not.toHaveBeenCalled();
});

it.each([true, false])(
  'saves the preview numbering %s instead of a different default',
  async verseNumbers => {
    const view = setup();
    view.preferences.mockResolvedValue({
      ...defaultPreferences,
      bible: {...defaultPreferences.bible, verseNumbers: !verseNumbers},
    });
    act(() => openBiblePassage(panelPassage(), {verseNumbers}));
    await view.user.click(view.button);
    await waitFor(() => expect(view.service().service.order).toHaveLength(6));
    expect(view.service().service.order[3]).toMatchObject({
      bible: {
        ref: panelPassage().ref,
        translation: panelPassage().translation,
        verseNumbers,
      },
    });
    expect(view.preferences).not.toHaveBeenCalled();
    expect(view.output).not.toHaveBeenCalled();
  },
);

it('waits for a held service read during close and uses the latest section boundary', async () => {
  const view = setup();
  let finish: (document: ReturnType<typeof view.service>) => void = () =>
    undefined;
  view.serviceRead.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  fireEvent.click(view.button);
  await waitFor(() => expect(view.serviceRead).toHaveBeenCalledOnce());
  let closed = false;
  const closing = pendingWritesOf(view.api)
    .flush()
    .then(result => {
      closed = true;
      return result;
    });
  await act(async () => {
    await Promise.resolve();
  });
  expect(closed).toBe(false);
  const id = createServiceItemId('00000000-0000-4000-8000-000000009009');
  const document = view.service();
  view.pushService({
    ...document,
    revision: document.revision + 1,
    service: {
      ...document.service,
      order: [
        ...document.service.order.slice(0, 3),
        {id, header: 'New section'},
        ...document.service.order.slice(3),
      ],
    },
  });
  await act(async () => finish(view.service()));
  expect(await closing).toBe(true);
  await waitFor(() => expect(view.service().service.order).toHaveLength(7));
  expect(view.service().service.order[3]).toMatchObject({
    bible: {ref: panelPassage().ref},
  });
  expect(view.service().service.order[4]?.id).toBe(id);
  expect(view.output).not.toHaveBeenCalled();
});

it('refuses the close when the held service read fails', async () => {
  const view = setup();
  let fail: (error: Error) => void = () => undefined;
  view.serviceRead.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      fail = reject;
    }),
  );
  fireEvent.click(view.button);
  await waitFor(() => expect(view.serviceRead).toHaveBeenCalledOnce());
  const closing = pendingWritesOf(view.api).flush();
  await act(async () => fail(new Error('Invented preferences failure')));
  expect(await closing).toBe(false);
  await waitFor(() => expect(view.problem).toHaveBeenCalledOnce());
  expect(view.service().service.order).toHaveLength(5);
  expect(view.history.document().value.recents).toEqual([]);
});

it('remembers an applied insertion when persistence fails and retains the warning', async () => {
  const view = setup();
  const edit = view.api.content.edit;
  vi.spyOn(view.api.content, 'edit').mockImplementationOnce(async change => {
    const applied = await edit(change);
    if (!applied.ok) throw Error('Fixture did not apply');
    return {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented failure',
        applied: applied.value,
        unchangedFiles: ['service.llservice'],
      },
    };
  });
  await view.user.click(view.button);
  await waitFor(() => expect(view.problem).toHaveBeenCalledOnce());
  expect(view.problem).toHaveBeenCalledWith(
    expect.objectContaining({title: '예배 순서 저장 실패'}),
  );
  expect(view.service().service.order).toHaveLength(6);
  await waitFor(() =>
    expect(view.history.document().value.recents).toEqual([
      {translation: panelPassage().translation, ref: panelPassage().ref},
    ]),
  );
  expect(view.output).not.toHaveBeenCalled();
});

it('accepts only one insertion while service reading is pending', async () => {
  const view = setup();
  let finish: (document: ReturnType<typeof view.service>) => void = () =>
    undefined;
  view.serviceRead.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  fireEvent.click(view.button);
  await waitFor(() => expect(view.serviceRead).toHaveBeenCalledOnce());
  act(() =>
    openBiblePassage({
      ...panelPassage(),
      ref: '요한복음 3:17-18',
      displayRef: '요한복음 3:17-18',
      verses: panelPassage().verses.slice(1),
    }),
  );
  fireEvent.click(view.button);
  expect(view.service().service.order).toHaveLength(5);
  expect(view.history.edit).not.toHaveBeenCalled();
  await act(async () => finish(view.service()));
  await waitFor(() => expect(view.service().service.order).toHaveLength(6));
  expect(view.edits).toHaveLength(1);
  expect(view.service().service.order[3]).toMatchObject({
    bible: {ref: '요한복음 3:16-18'},
  });
  expect(view.output).not.toHaveBeenCalled();
});

it('reports a refused insertion without adding a recent passage', async () => {
  const view = setup();
  vi.spyOn(view.api.content, 'edit').mockResolvedValueOnce({
    ok: false,
    error: {reason: 'read-only', message: 'Invented insertion failure'},
  });
  await view.user.click(view.button);
  await waitFor(() => expect(view.problem).toHaveBeenCalledOnce());
  expect(view.service().service.order).toHaveLength(5);
  expect(view.history.edit).not.toHaveBeenCalled();
  expect(view.output).not.toHaveBeenCalled();
});

it.each(['closed', 'readOnly'])(
  'blocks insertion into a %s service',
  async state => {
    const view = setup();
    act(() =>
      useShow.setState(
        state === 'closed' ? {serviceId: null} : {readOnly: true},
      ),
    );
    expect(view.button.getAttribute('aria-disabled')).toBe('true');
    await view.user.click(view.button);
    expect(view.preferences).not.toHaveBeenCalled();
    expect(view.edits).toHaveLength(0);
    expect(view.history.edit).not.toHaveBeenCalled();
  },
);

it('ignores a selected row belonging to another service', async () => {
  const view = setup();
  const source = useShow.getState().bibleSource;
  if (!source) {
    throw new Error('Missing Bible source');
  }
  act(() =>
    useShow.setState({
      bibleSource: {
        ...source,
        insertion: {serviceId: 'other-service', itemId: fixtureItems.header},
      },
    }),
  );
  await view.user.click(view.button);
  await waitFor(() => expect(view.service().service.order).toHaveLength(6));
  expect(view.service().service.order.at(-1)).toHaveProperty('bible');
  expect(view.service().service.order[0]?.id).toBe(fixtureItems.header);
  expect(view.output).not.toHaveBeenCalled();
});

it('resolves the current section boundary after another section is inserted during preview', async () => {
  const view = setup();
  const id = createServiceItemId('00000000-0000-4000-8000-000000009009');
  const document = view.service();
  view.pushService({
    ...document,
    service: {
      ...document.service,
      order: [
        ...document.service.order.slice(0, 3),
        {id, header: 'New section'},
        ...document.service.order.slice(3),
      ],
    },
  });
  const rows = useShow.getState().rows;
  act(() =>
    useShow.setState({
      rows: [
        ...rows.slice(0, 3),
        {kind: 'header', id, title: 'New section'},
        ...rows.slice(3),
      ],
    }),
  );
  await view.user.click(view.button);
  await waitFor(() => expect(view.service().service.order).toHaveLength(7));
  expect(view.service().service.order[3]).toHaveProperty('bible');
  expect(view.service().service.order[4]?.id).toBe(id);
});
