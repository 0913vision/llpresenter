import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  settingsDocument,
  screensDocument,
} from '@renderer/screens/testing/documents';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {LIVE_STATE_LIMITS} from '@shared/schema/liveLimits';
import {ShowToolsPanel} from '../ShowToolsPanel';
import {StageTab} from './StageTab';
import {
  stageFixture,
  STAGE_ID,
  LOOK_ID,
  SERMON_LOOK_ID,
  WIDE_LAYOUT_ID,
  TIMER_ID,
  SECOND_STAGE,
} from './stageTesting';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShowToolTab.setState({tool: 'showing'});
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
  it('mounts only on its tab and releases all five document subscriptions', async () => {
    const fixture = stageFixture();
    useShowToolTab.setState({tool: 'message'});
    const {unmount} = render(<ShowToolsPanel sizeClass="narrow" />);
    await waitFor(() => expect(fixture.count()).toBe(5));
    fixture.get.mockClear();
    fireEvent.click(screen.getByRole('tab', {name: '무대'}));
    expect(
      await screen.findByRole('button', {name: '무대 화면 무대 배치'}),
    ).toBeTruthy();
    expect(fixture.count()).toBe(8);
    fireEvent.click(screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}));
    fireEvent.click(
      screen.getByRole('menuitemradio', {name: '\uba54\uc2dc\uc9c0'}),
    );
    await waitFor(() => expect(fixture.count()).toBe(5));
    unmount();
    expect(fixture.count()).toBe(0);
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('uses the current Look and changes only the chosen stage screen layout', async () => {
    const fixture = stageFixture();
    const screens = screensDocument();
    if (screens.name !== 'screens') throw new Error('Wrong fixture');
    fixture.documents.set(
      'screens',
      settingsDocument('screens', {
        screens: [
          ...screens.value.screens,
          {
            id: SECOND_STAGE,
            name: '보조 무대',
            kind: 'stage',
            method: 'window',
          },
        ],
      }),
    );
    render(<StageTab />);
    const select = await screen.findByRole('button', {
      name: '무대 화면 무대 배치',
    });
    await waitFor(() => expect(select.textContent).toBe('현재와 다음'));
    expect(
      screen.queryByRole('button', {name: '본 화면 무대 배치'}),
    ).toBeNull();
    await choose('보조 무대 무대 배치', '하단 자막');
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.layout.set',
      screenId: SECOND_STAGE,
      layoutId: WIDE_LAYOUT_ID,
    });
    expect(fixture.edit).not.toHaveBeenCalled();
    act(() => fixture.live({stageLayouts: {[STAGE_ID]: WIDE_LAYOUT_ID}}));
    expect(select.textContent).toBe('하단 자막');
    act(() => fixture.live({lookId: SERMON_LOOK_ID}));
    expect(select.textContent).toBe('하단 자막');
    act(() => fixture.live({lookId: LOOK_ID}));
    expect(select.textContent).toBe('현재와 다음');
  });

  it('falls back from a missing live Look and identifies a deleted layout', async () => {
    const fixture = stageFixture();
    fixture.live({lookId: SECOND_STAGE});
    render(<StageTab />);
    const select = await screen.findByRole('button', {
      name: '무대 화면 무대 배치',
    });
    await waitFor(() => expect(select.textContent).toBe('현재와 다음'));
    act(() =>
      fixture.push(
        settingsDocument(
          'stage-layouts',
          {format: 'llsettings.stage', layouts: []},
          2,
        ),
      ),
    );
    expect(select.textContent).toBe('삭제된 배치');
    expect(select.getAttribute('aria-disabled')).toBe('true');
  });

  it('selects and clears the live timer without starting it or saving settings', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await choose('무대 타이머', '예배 시작');
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'stage.timer.set',
      timerId: TIMER_ID,
    });
    act(() => fixture.live({lookId: SERMON_LOOK_ID, stageTimerId: TIMER_ID}));
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
    await screen.findByRole('button', {name: '무대 화면 무대 배치'});
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '  마지막 후렴  '}});
    fireEvent.click(screen.getByRole('button', {name: '보내기'}));
    fireEvent.keyDown(input, {key: 'Enter', isComposing: true});
    fireEvent.keyDown(input, {key: 'Process'});
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.message.set',
      text: '마지막 후렴',
    });
    fireEvent.keyDown(input, {key: 'Enter'});
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
    await screen.findByRole('button', {name: '무대 화면 무대 배치'});
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '마지막 후렴'}});
    const enter = (repeat: boolean): boolean =>
      fireEvent.keyDown(input, {key: 'Enter', repeat, cancelable: true});
    expect(enter(false)).toBe(false);
    expect(enter(true)).toBe(false);
    expect(enter(true)).toBe(false);
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.message.set',
      text: '마지막 후렴',
    });
    expect(bubbled).not.toHaveBeenCalled();
    fireEvent.keyUp(input, {key: 'Enter'});
    expect(enter(false)).toBe(false);
    expect(fixture.send).toHaveBeenCalledTimes(2);
    expect(bubbled).not.toHaveBeenCalled();
  });

  it('refuses blank and oversized text and accepts the text limit', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await screen.findByRole('button', {name: '무대 화면 무대 배치'});
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
      fireEvent.keyDown(input, {key: 'Enter'});
    }
    expect(fixture.send).not.toHaveBeenCalled();
    const text = 'x'.repeat(LIVE_STATE_LIMITS.textCharacters);
    fireEvent.change(input, {target: {value: text}});
    fireEvent.keyDown(input, {key: 'Enter'});
    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'stage.message.set',
      text,
    });
  });

  it('follows live messages and preset edits while keeping the draft', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await screen.findByRole('button', {name: '무대 화면 무대 배치'});
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '아직 준비 중'}});
    fireEvent.click(await screen.findByRole('button', {name: '후렴 한 번 더'}));
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'stage.message.set',
      text: '후렴 한 번 더',
    });
    act(() => fixture.live({stageMessage: '후렴 한 번 더'}));
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(
      screen
        .getByRole('button', {name: '후렴 한 번 더'})
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(input.getAttribute('value')).toBe('아직 준비 중');
    fireEvent.click(screen.getByRole('button', {name: '내리기'}));
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'stage.message.set',
      text: null,
    });
    act(() => fixture.live({}));
    expect(screen.queryByText('LIVE')).toBeNull();
    expect(
      screen
        .getByRole('button', {name: '내리기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    act(() =>
      fixture.push(
        settingsDocument(
          'messages',
          {templates: [], stagePresets: ['처음부터']},
          2,
        ),
      ),
    );
    expect(screen.queryByRole('button', {name: '후렴 한 번 더'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '처음부터'}));
    expect(fixture.send).toHaveBeenLastCalledWith({
      type: 'stage.message.set',
      text: '처음부터',
    });
  });

  it('disables sends and presets when the stage screen disappears', async () => {
    const fixture = stageFixture();
    render(<StageTab />);
    await screen.findByRole('button', {name: '무대 화면 무대 배치'});
    act(() => fixture.push(settingsDocument('screens', {screens: []}, 2)));
    const input = screen.getByRole('textbox', {name: '무대 메시지'});
    fireEvent.change(input, {target: {value: '마지막 후렴'}});
    fireEvent.keyDown(input, {key: 'Enter'});
    fireEvent.click(screen.getByRole('button', {name: '보내기'}));
    fireEvent.click(screen.getByRole('button', {name: '마무리'}));
    expect(fixture.send).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', {name: '무대 타이머'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('bounds preset buttons and disables malformed saved presets', async () => {
    const fixture = stageFixture();
    fixture.documents.set(
      'messages',
      settingsDocument('messages', {
        templates: [],
        stagePresets: [
          '',
          'x'.repeat(4001),
          ...Array.from({length: 60}, (_, i) => `프리셋 ${i}`),
        ],
      }),
    );
    render(<StageTab />);
    const group = screen.getByRole('group', {name: '무대 메시지 프리셋'});
    await waitFor(() =>
      expect(within(group).getAllByRole('button')).toHaveLength(50),
    );
    for (const button of within(group).getAllByRole('button').slice(0, 2)) {
      expect(button.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(button);
    }
    expect(fixture.send).not.toHaveBeenCalled();
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
