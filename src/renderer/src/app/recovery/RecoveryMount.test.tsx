import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {RecoveryResult, RecoverySummary} from '@core/schema/recovery';
import {editorFixture} from '@renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/platform/live';
import {applyService} from '@renderer/state/show';
import {App} from '../App';
import {ControlSession} from '../controlSession';
import {sampleOffer} from './testing';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];
const restored: RecoveryResult = {ok: true, value: null};

// NOTE(0913vision): Each read answers the next offer; an Error rejects it.
function setup(offers: ReadonlyArray<RecoverySummary | Error>) {
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 1080);
  const {api} = editorFixture();
  const summary = vi.spyOn(api.recovery, 'summary');
  for (const offer of offers) {
    if (offer instanceof Error) summary.mockRejectedValueOnce(offer);
    else summary.mockResolvedValueOnce(offer);
  }
  summary.mockResolvedValue(null);
  const apply = vi.spyOn(api.recovery, 'apply').mockResolvedValue(restored);
  const startFresh = vi
    .spyOn(api.recovery, 'startFresh')
    .mockResolvedValue(restored);
  const send = vi.spyOn(api.live, 'send');
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  render(
    <App session={session} columnWidthStore={createMemoryColumnWidthStore()} />,
  );
  return {summary, apply, startFresh, send};
}

const dialog = () =>
  screen.queryByRole('alertdialog', {name: '출력 상태 복구'});

beforeEach(() => {
  applyService(null);
  useLive.setState({state: emptyLiveState()});
});
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  delete window.llp;
  useLive.setState({state: null});
});

it('shows no dialog when main offers nothing to restore', async () => {
  const {summary} = setup([null]);
  await waitFor(() => expect(summary).toHaveBeenCalled());
  expect(dialog()).toBeNull();
});

it('restores the checked rows of the offered record and closes', async () => {
  const offer = sampleOffer();
  const {apply} = setup([offer]);
  await screen.findByRole('alertdialog', {name: '출력 상태 복구'});
  await userEvent.click(screen.getByRole('button', {name: '복구'}));
  expect(apply).toHaveBeenCalledExactlyOnceWith({
    savedAt: offer.savedAt,
    rows: ['outputs', 'slide', 'showing'],
  });
  await waitFor(() => expect(dialog()).toBeNull());
});

it('starts fresh and closes', async () => {
  const {startFresh, apply} = setup([sampleOffer()]);
  await screen.findByRole('alertdialog', {name: '출력 상태 복구'});
  await userEvent.click(screen.getByRole('button', {name: '새로 시작'}));
  expect(startFresh).toHaveBeenCalledOnce();
  expect(apply).not.toHaveBeenCalled();
  await waitFor(() => expect(dialog()).toBeNull());
});

it('reads the offer again after a stale answer and shows its rows', async () => {
  const {apply} = setup([sampleOffer(), sampleOffer(['outputs'])]);
  apply.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'stale', message: 'Invented newer record'},
  });
  await screen.findByRole('alertdialog', {name: '출력 상태 복구'});
  await userEvent.click(screen.getByRole('button', {name: '복구'}));
  await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(1));
  expect(dialog()).not.toBeNull();
});

it('closes and warns when a restore changed nothing', async () => {
  const {apply} = setup([sampleOffer()]);
  apply.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'apply-failed', message: 'Invented rejected commands'},
  });
  await screen.findByRole('alertdialog', {name: '출력 상태 복구'});
  await userEvent.click(screen.getByRole('button', {name: '복구'}));
  expect(
    await screen.findByRole('alert', {name: '출력 상태 복구 실패'}),
  ).toBeDefined();
  expect(dialog()).toBeNull();
});

it('keeps the dialog and warns when the answer cannot be sent', async () => {
  const {startFresh} = setup([sampleOffer()]);
  startFresh.mockRejectedValueOnce(new Error('Invented closed channel'));
  await screen.findByRole('alertdialog', {name: '출력 상태 복구'});
  await userEvent.click(screen.getByRole('button', {name: '새로 시작'}));
  expect(
    await screen.findByRole('alert', {name: '출력 상태 복구 실패'}),
  ).toBeDefined();
  expect(dialog()).not.toBeNull();
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', {name: '새로 시작'})
        .getAttribute('aria-disabled'),
    ).toBeNull(),
  );
});

it('reports an offer that cannot be read and reads it again with 다시 시도', async () => {
  const {summary} = setup([
    new Error('Invented closed channel'),
    sampleOffer(),
  ]);
  const card = await screen.findByRole('alert', {
    name: '복구할 출력 상태를 읽을 수 없음',
  });
  expect(dialog()).toBeNull();
  await userEvent.click(within(card).getByRole('button', {name: '다시 시도'}));
  expect(
    await screen.findByRole('alertdialog', {name: '출력 상태 복구'}),
  ).toBeDefined();
  expect(summary).toHaveBeenCalledTimes(2);
});

it('lets F1 clear the screens while the dialog is open', async () => {
  const {send} = setup([sampleOffer()]);
  await screen.findByRole('alertdialog', {name: '출력 상태 복구'});
  const empty = emptyLiveState();
  useLive.setState({
    state: {
      ...empty,
      layers: {
        ...empty.layers,
        slide: {itemId: 'invented', position: 0, label: null, lines: ['가사']},
      },
    },
  });
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'F1', code: 'F1', bubbles: true}),
    );
  });
  expect(send).toHaveBeenCalledWith({
    type: 'layer.clear.toggle',
    target: 'all',
  });
  expect(dialog()).not.toBeNull();
});
