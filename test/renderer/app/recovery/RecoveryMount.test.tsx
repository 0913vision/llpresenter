import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {RecoveryResult, RecoverySummary} from '@core/schema/recovery';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
import {applyService} from '@renderer/session/show';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';
import {sampleOffer} from '@fixtures/renderer/app/recovery/testing';

vi.mock('@renderer/rendering/outputRenderer', () => ({
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
  screen.queryByRole('alertdialog', {name: '출력 내용을 복구할까요?'});

it('keeps the dialog and checked rows available to retry a failed durable restore', async () => {
  const offer = sampleOffer();
  const {apply, summary} = setup([offer, offer]);
  apply.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'apply-failed', message: 'Invented failed durable write'},
  });
  await screen.findByRole('alertdialog', {name: '출력 내용을 복구할까요?'});
  await userEvent.click(
    screen.getByRole('checkbox', {name: /마지막 슬라이드/}),
  );
  await userEvent.click(screen.getByRole('button', {name: '복구'}));

  await waitFor(() => expect(summary).toHaveBeenCalledTimes(2));
  expect(dialog()).not.toBeNull();
  expect(
    screen
      .getByRole('checkbox', {name: /마지막 슬라이드/})
      .getAttribute('aria-checked'),
  ).toBe('false');
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '복구'}).getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
  await userEvent.click(screen.getByRole('button', {name: '복구'}));
  await waitFor(() => expect(dialog()).toBeNull());
  expect(apply).toHaveBeenCalledTimes(2);
  expect(apply.mock.calls.map(([answer]) => answer)).toEqual([
    {savedAt: offer.savedAt, rows: ['outputs', 'showing']},
    {savedAt: offer.savedAt, rows: ['outputs', 'showing']},
  ]);
});

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

it('lets F1 clear the screens while the dialog is open', async () => {
  const {send} = setup([sampleOffer()]);
  await screen.findByRole('alertdialog', {name: '출력 내용을 복구할까요?'});
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
