import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {
  settingsDocument,
  screensDocument,
  MAIN_ID,
  CAPTIONS_ID,
} from '@renderer/screens/testing/documents';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {ShowToolsPanel} from '../ShowToolsPanel';
import {MessageTab} from './MessageTab';
import {stageFixture} from './stageTesting';

const first = {
  id: '00000000-0000-4000-8000-000000000021',
  name: '차량 이동',
  icon: 'msg',
  text: '{차량 번호} 차량 이동 부탁드립니다',
};
const second = {
  id: '00000000-0000-4000-8000-000000000022',
  name: '안내',
  icon: 'user',
  text: '{이름} 안내석으로 와 주세요',
  targets: [CAPTIONS_ID],
  duration: 45,
};

function messageFixture(templates: readonly object[] = [first, second]) {
  const fixture = stageFixture();
  fixture.documents.set(
    'messages',
    settingsDocument('messages', {templates, stagePresets: []}),
  );
  return {
    ...fixture,
    pushMessages(
      templates: readonly object[],
      revision: number,
      stagePresets: readonly string[] = [],
    ): void {
      act(() =>
        fixture.push(
          settingsDocument('messages', {templates, stagePresets}, revision),
        ),
      );
    },
  };
}

const sendButton = (): HTMLElement =>
  screen.getByRole('button', {name: '보내기'});
const preview = (): HTMLElement =>
  screen.getByRole('status', {name: '메시지 미리보기'});
const fill = (name: string, value: string): void => {
  fireEvent.change(screen.getByRole('textbox', {name}), {target: {value}});
};
async function ready(): Promise<void> {
  await screen.findByRole('button', {name: '본 화면'});
  await screen.findByRole('option', {name: '차량 이동'});
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShowToolTab.setState({tool: 'showing'});
});
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

it('mounts only on the message tab and releases both document subscriptions', async () => {
  const fixture = messageFixture();
  const {unmount} = render(<ShowToolsPanel sizeClass="normal" />);
  await waitFor(() => expect(fixture.count()).toBe(8));
  fixture.get.mockClear();
  fireEvent.click(screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}));
  fireEvent.click(
    screen.getByRole('menuitemradio', {name: '\uba54\uc2dc\uc9c0'}),
  );
  await ready();
  expect(fixture.count()).toBe(5);
  expect(fixture.get.mock.calls.map(([request]) => request.name)).toEqual([
    'messages',
    'screens',
  ]);
  fireEvent.click(screen.getByRole('tab', {name: '무대'}));
  await waitFor(() => expect(fixture.count()).toBe(8));
  unmount();
  expect(fixture.count()).toBe(0);
  expect(fixture.send).not.toHaveBeenCalled();
});

it('previews literal values and sends optional defaults as all screens until cleared', async () => {
  const fixture = messageFixture();
  render(<MessageTab />);
  await ready();
  expect(sendButton().getAttribute('aria-disabled')).toBe('true');
  fill('차량 번호', '   ');
  fireEvent.click(sendButton());
  expect(fixture.send).not.toHaveBeenCalled();
  fill('차량 번호', '12가 $&');
  expect(preview().textContent).toBe('12가 $& 차량 이동 부탁드립니다');
  fireEvent.click(sendButton());
  expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
    type: 'message.send',
    text: preview().textContent,
    targets: 'all',
    duration: null,
  });
  expect(fixture.edit).not.toHaveBeenCalled();
  expect(
    screen.getByRole('textbox', {name: '차량 번호'}).getAttribute('value'),
  ).toBe('12가 $&');
});

it('makes all and individual targets exclusive and disables sending with none', async () => {
  const fixture = messageFixture();
  render(<MessageTab />);
  await ready();
  fill('차량 번호', '12가 3456');
  const all = screen.getByRole('button', {name: '모든 화면'});
  fireEvent.click(all);
  expect(sendButton().getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(sendButton());
  expect(fixture.send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  fireEvent.click(screen.getByRole('button', {name: '방송 자막'}));
  expect(all.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(sendButton());
  expect(fixture.send).toHaveBeenLastCalledWith(
    expect.objectContaining({targets: [MAIN_ID, CAPTIONS_ID]}),
  );
  fireEvent.click(all);
  for (const name of ['본 화면', '방송 자막', '무대 화면']) {
    expect(
      screen.getByRole('button', {name}).getAttribute('aria-pressed'),
    ).toBe('false');
  }
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  expect(all.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  expect(sendButton().getAttribute('aria-disabled')).toBe('true');
});

it('loads stored defaults, offers every duration, and resets the draft when switching templates', async () => {
  const fixture = messageFixture();
  render(<MessageTab />);
  await ready();
  fill('차량 번호', 'draft');
  fireEvent.click(screen.getByRole('option', {name: '안내'}));
  expect(screen.queryByRole('textbox', {name: '차량 번호'})).toBeNull();
  fill('이름', '홍길동');
  const duration = screen.getByRole('button', {name: '메시지 표시 시간'});
  expect(duration.textContent).toBe('45초');
  fireEvent.click(sendButton());
  expect(fixture.send).toHaveBeenLastCalledWith({
    type: 'message.send',
    text: '홍길동 안내석으로 와 주세요',
    targets: [CAPTIONS_ID],
    duration: 45,
  });
  for (const [label, seconds] of [
    ['30초', 30],
    ['45초', 45],
    ['1분', 60],
    ['2분', 120],
    ['계속', null],
  ] as const) {
    fireEvent.click(duration);
    fireEvent.click(screen.getByRole('menuitemradio', {name: label}));
    fireEvent.click(sendButton());
    expect(fixture.send).toHaveBeenLastCalledWith(
      expect.objectContaining({duration: seconds}),
    );
  }
  fireEvent.click(screen.getByRole('option', {name: '차량 이동'}));
  expect(
    screen.getByRole('textbox', {name: '차량 번호'}).getAttribute('value'),
  ).toBe('');
  expect(
    screen
      .getByRole('button', {name: '모든 화면'})
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    screen.getByRole('button', {name: '메시지 표시 시간'}).textContent,
  ).toBe('계속');
  expect(fixture.edit).not.toHaveBeenCalled();
});

it('keeps a draft on unrelated pushes, resets changed defaults, and follows template removal', async () => {
  const fixture = messageFixture();
  render(<MessageTab />);
  await ready();
  fill('차량 번호', 'kept');
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  fixture.pushMessages([first, second], 2, ['마무리']);
  expect(preview().textContent).toBe('kept 차량 이동 부탁드립니다');
  expect(
    screen.getByRole('button', {name: '본 화면'}).getAttribute('aria-pressed'),
  ).toBe('true');
  fixture.pushMessages([{...first, duration: 30}, second], 3);
  expect(
    screen.getByRole('textbox', {name: '차량 번호'}).getAttribute('value'),
  ).toBe('');
  expect(
    screen.getByRole('button', {name: '메시지 표시 시간'}).textContent,
  ).toBe('30초');
  fixture.pushMessages([second], 4);
  expect(screen.queryByRole('textbox', {name: '차량 번호'})).toBeNull();
  expect(screen.getByRole('textbox', {name: '이름'})).toBeTruthy();
  fixture.pushMessages([], 5);
  expect(screen.queryByRole('button', {name: '보내기'})).toBeNull();
  expect(fixture.send).not.toHaveBeenCalled();
});

it('drops deleted explicit targets and keeps all literal when configured screens change', async () => {
  const fixture = messageFixture();
  render(<MessageTab />);
  await ready();
  fill('차량 번호', '12가');
  fireEvent.click(screen.getByRole('button', {name: '본 화면'}));
  act(() => fixture.push(settingsDocument('screens', {screens: []}, 2)));
  expect(sendButton().getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(sendButton());
  expect(fixture.send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '모든 화면'}));
  expect(sendButton().getAttribute('aria-disabled')).toBe('true');
  act(() => fixture.push(screensDocument(3)));
  fireEvent.click(sendButton());
  expect(fixture.send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      targets: 'all',
      text: '12가 차량 이동 부탁드립니다',
    }),
  );
});

it('renders one field per exact blank, including names from the object prototype', async () => {
  const fixture = messageFixture([
    {...first, text: '{toString}, {__proto__}, {toString}, { name }{toStringx'},
  ]);
  render(<MessageTab />);
  await ready();
  expect(screen.getAllByRole('textbox')).toHaveLength(3);
  expect(
    within(screen.getByRole('option', {name: '차량 이동'})).getAllByText(
      'toString',
    ),
  ).toHaveLength(2);
  fill('toString', '$&');
  fill('__proto__', 'own');
  fill('name', 'value');
  fireEvent.click(sendButton());
  expect(fixture.send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({text: '$&, own, $&, value{toStringx'}),
  );
});

it('accepts the output boundary but refuses oversized expansion and saved text', async () => {
  const fixture = messageFixture([{...first, text: '{value}{value}'}]);
  render(<MessageTab />);
  await ready();
  fill('value', 'x'.repeat(2000));
  fireEvent.click(sendButton());
  expect(fixture.send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({text: 'x'.repeat(4000)}),
  );
  fill('value', 'x'.repeat(2001));
  expect(sendButton().getAttribute('aria-disabled')).toBe('true');
  expect(preview().textContent).toBe('');
  for (const [index, text] of ['x'.repeat(4001), '  '].entries()) {
    fixture.pushMessages([{...first, text}], index + 2);
    expect(sendButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(sendButton());
  }
  expect(fixture.send).toHaveBeenCalledTimes(1);
});

it('sends once per Enter press and does not send from a blank field', async () => {
  const fixture = messageFixture();
  render(<MessageTab />);
  await ready();
  fill('차량 번호', '12가');
  const user = userEvent.setup();
  screen.getByRole('textbox', {name: '차량 번호'}).focus();
  await user.keyboard('{Enter}');
  expect(fixture.send).not.toHaveBeenCalled();
  sendButton().focus();
  await user.keyboard('{Enter>3/}');
  expect(fixture.send).toHaveBeenCalledTimes(1);
  await user.keyboard('{Enter}');
  expect(fixture.send).toHaveBeenCalledTimes(2);
});

it('reports failed settings reads, blocks output, and releases subscriptions', async () => {
  const fixture = messageFixture();
  const problem = vi.fn();
  fixture.get.mockRejectedValueOnce(new Error('Invented read failure'));
  const view = render(<MessageTab onProblem={problem} />);
  await waitFor(() => expect(problem).toHaveBeenCalledOnce());
  expect(fixture.log).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', {name: '보내기'})).toBeNull();
  view.unmount();
  expect(fixture.count()).toBe(0);
  expect(fixture.send).not.toHaveBeenCalled();
});
