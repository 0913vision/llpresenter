import {settingsDocument} from '@fixtures/core/settingsDocument';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {StageTab} from '@renderer/features/tools/StageTab';
import {
  stageFixture,
  TIMER_ID,
} from '@fixtures/renderer/features/tools/stageTesting';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShowToolTab.setState({tool: 'audio'});
});
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

async function choose(label: string, option: string): Promise<void> {
  const select = await screen.findByRole('button', {name: label});
  await waitFor(() =>
    expect(select.getAttribute('aria-disabled')).not.toBe('true'),
  );
  fireEvent.click(select);
  fireEvent.click(await screen.findByRole('menuitemradio', {name: option}));
}

describe('stage tool', () => {
  it('selects and clears the live timer without starting it or saving settings', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await choose('무대 타이머', '예배 시작');
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'stage.timer.set',
      timerId: TIMER_ID,
    });
    act(() => fixture.live({stageTimerId: TIMER_ID}));
    expect(screen.getByRole('button', {name: '무대 타이머'}).textContent).toBe(
      '예배 시작',
    );
    await choose('무대 타이머', '없음');
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'stage.timer.set',
      timerId: null,
    });
    act(() => fixture.push(settingsDocument('timers', {timers: []}, 2)));
    expect(screen.getByRole('button', {name: '무대 타이머'}).textContent).toBe(
      '없음',
    );
    expect(fixture.send).toHaveBeenCalledTimes(2);
    expect(fixture.edit).not.toHaveBeenCalled();
  });

  it('sends by button and Enter but does not send during IME composition', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await screen.findByRole('button', {name: '무대 타이머'});
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '  마지막 후렴  '}});
    fireEvent.click(screen.getByRole('button', {name: '보내기'}));
    fireEvent.keyDown(input, {key: 'Enter', code: 'Enter', isComposing: true});
    fireEvent.keyDown(input, {key: 'Process'});
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.message.set',
      text: '마지막 후렴',
    });
    fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});
    expect(fixture.send).toHaveBeenCalledTimes(2);
    expect(fixture.send.mock.calls[1]).toEqual(fixture.send.mock.calls[0]);
  });

  it('consumes held Enter without sending again until the next press', async () => {
    const fixture = stageFixture();
    const bubbled = vi.fn();
    render(
      <div onKeyDown={bubbled}>
        <StageTab />
      </div>,
    );
    await screen.findByRole('button', {name: '무대 타이머'});
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '마지막 후렴'}});
    const enter = (repeat: boolean): boolean =>
      fireEvent.keyDown(input, {
        key: 'Enter',
        code: 'Enter',
        repeat,
        cancelable: true,
      });
    expect(enter(false)).toBe(false);
    expect(enter(true)).toBe(false);
    expect(enter(true)).toBe(false);
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.message.set',
      text: '마지막 후렴',
    });
    expect(bubbled).not.toHaveBeenCalled();
    fireEvent.keyUp(input, {key: 'Enter', code: 'Enter'});
    expect(enter(false)).toBe(false);
    expect(fixture.send).toHaveBeenCalledTimes(2);
    expect(bubbled).not.toHaveBeenCalled();
  });

  it('refuses blank and oversized text and accepts the text limit', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await screen.findByRole('button', {name: '무대 타이머'});
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    for (const text of [
      '',
      '   ',
      'x'.repeat(LIVE_STATE_LIMITS.textCharacters + 1),
    ]) {
      fireEvent.change(input, {target: {value: text}});
      const send = screen.getByRole('button', {name: '보내기'});
      expect(send.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(send);
      fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});
    }
    expect(fixture.send).not.toHaveBeenCalled();
    const text = 'x'.repeat(LIVE_STATE_LIMITS.textCharacters);
    fireEvent.change(input, {target: {value: text}});
    fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.message.set',
      text,
    });
  });

  it('follows and clears live messages while keeping the draft', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await screen.findByRole('button', {name: '무대 타이머'});
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '아직 준비 중'}});
    act(() => fixture.live({stageMessage: '후렴 한 번 더'}));
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(input.getAttribute('value')).toBe('아직 준비 중');
    fireEvent.click(screen.getByRole('button', {name: '지우기'}));
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'stage.message.set',
      text: null,
    });
    act(() => fixture.live({}));
    expect(screen.queryByText('LIVE')).toBeNull();
    expect(
      screen
        .getByRole('button', {name: '지우기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(input.getAttribute('value')).toBe('아직 준비 중');
  });

  it('disables sends when the stage screen disappears', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await screen.findByRole('button', {name: '무대 타이머'});
    act(() => fixture.push(settingsDocument('screens', {screens: []}, 2)));
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '마지막 후렴'}});
    fireEvent.keyDown(input, {key: 'Enter', code: 'Enter'});
    fireEvent.click(screen.getByRole('button', {name: '보내기'}));
    expect(fixture.send).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', {name: '무대 타이머'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('reports failed settings reads and releases subscriptions on unmount', async () => {
    const fixture = stageFixture();
    const problem = vi.fn();
    fixture.get.mockRejectedValueOnce(new Error('Invented read failure'));
    const view = render(<StageTab onProblem={problem} />);
    await waitFor(() => expect(problem).toHaveBeenCalledOnce());
    expect(fixture.log).toHaveBeenCalledOnce();
    expect(
      screen
        .getByRole('button', {name: '보내기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    view.unmount();
    expect(fixture.count()).toBe(0);
  });
});
