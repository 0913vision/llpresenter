import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {AlertDialog} from './AlertDialog';
import {Checkbox} from './Checkbox';
import {Dialog, DialogBox, DialogField} from './Dialog';
import {TextArea} from './TextArea';
import {TextField} from './TextField';
import {enterPressesPrimary} from './useModal';

interface Handlers {
  readonly onCancel?: () => void;
  readonly onCreate?: () => void;
  readonly createDisabled?: boolean;
}

function NewService({
  onCancel = () => {},
  onCreate = () => {},
  createDisabled = false,
}: Handlers): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('주일 예배');
  const [notes, setNotes] = useState('');
  const close = (run: () => void) => () => {
    run();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        새 예배
      </button>
      {open ? (
        <Dialog
          title="새 예배"
          size="l"
          onCancel={close(onCancel)}
          primary={{
            label: '만들기',
            onSelect: close(onCreate),
            disabled: createDisabled,
          }}
          bottomBar={
            <DialogField label="이름">
              <TextField aria-label="이름" value={name} onChange={setName} />
            </DialogField>
          }
        >
          <TextArea aria-label="메모" value={notes} onChange={setNotes} />
        </Dialog>
      ) : null}
    </>
  );
}

async function openDialog(): Promise<void> {
  await userEvent.click(screen.getByRole('button', {name: '새 예배'}));
}

function appRoot(): Element {
  const root = screen.getByRole('button', {name: '새 예배'}).parentElement;
  if (root === null) throw new Error('No app root');
  return root;
}

describe('Dialog', () => {
  it('is a modal dialog named by its title', async () => {
    render(<NewService />);
    await openDialog();
    const dialog = screen.getByRole('dialog', {name: '새 예배'});
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('starts in the first text field with its text selected', async () => {
    render(<NewService />);
    await openDialog();
    const field = screen.getByRole('textbox', {name: '메모'});
    expect(document.activeElement).toBe(field);
  });

  it('makes the app behind it inert until it closes', async () => {
    render(<NewService />);
    await openDialog();
    expect(appRoot().hasAttribute('inert')).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(appRoot().hasAttribute('inert')).toBe(false);
  });

  it('cancels with Esc, the close button, and 취소, and returns focus', async () => {
    const onCancel = vi.fn();
    render(<NewService onCancel={onCancel} />);
    await openDialog();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '새 예배'}),
    );
    await openDialog();
    await userEvent.click(screen.getByRole('button', {name: '닫기'}));
    await openDialog();
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('presses the primary button with Enter in a single-line field', async () => {
    const onCreate = vi.fn();
    render(<NewService onCreate={onCreate} />);
    await openDialog();
    await userEvent.click(screen.getByRole('textbox', {name: '이름'}));
    await userEvent.keyboard('{Enter}');
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('keeps Enter in a multiline field', async () => {
    const onCreate = vi.fn();
    render(<NewService onCreate={onCreate} />);
    await openDialog();
    await userEvent.keyboard('{Enter}');
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: '메모'})).toHaveProperty(
      'value',
      '\n',
    );
  });

  it('ignores Enter while the primary button is disabled', async () => {
    const onCreate = vi.fn();
    render(<NewService onCreate={onCreate} createDisabled />);
    await openDialog();
    await userEvent.click(screen.getByRole('textbox', {name: '이름'}));
    await userEvent.keyboard('{Enter}');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the dialog', async () => {
    render(<NewService />);
    await openDialog();
    const close = screen.getByRole('button', {name: '닫기'});
    const create = screen.getByRole('button', {name: '만들기'});
    create.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(create);
  });

  it('lets the 지우기 keys reach the window', async () => {
    const onWindowKey = vi.fn();
    const listener = (event: KeyboardEvent): void => {
      if (!event.defaultPrevented) onWindowKey(event.key);
    };
    window.addEventListener('keydown', listener);
    render(<NewService />);
    await openDialog();
    await userEvent.keyboard('{F2}');
    window.removeEventListener('keydown', listener);
    expect(onWindowKey).toHaveBeenCalledWith('F2');
  });

  it('draws a list box with a select-all checkbox', () => {
    render(
      <DialogBox
        title="예배 순서"
        meta="항목 9개"
        checkAll={{checked: 'mixed', onChange: () => {}}}
      >
        <span>찬양</span>
      </DialogBox>,
    );
    expect(
      screen
        .getByRole('checkbox', {name: '예배 순서'})
        .getAttribute('aria-checked'),
    ).toBe('mixed');
    expect(screen.getByText('항목 9개')).toBeDefined();
  });
});

function Overwrite({
  onCancel = () => {},
  onOverwrite = () => {},
}: {
  readonly onCancel?: () => void;
  readonly onOverwrite?: () => void;
}): JSX.Element {
  return (
    <AlertDialog
      icon="song"
      title="‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?"
      meta={['라이브러리 곡 4장, 10월 20일 수정']}
      onCancel={onCancel}
      actions={[
        {label: '새 곡으로 저장', onSelect: () => {}},
        {label: '덮어쓰기', primary: true, onSelect: onOverwrite},
      ]}
    />
  );
}

describe('AlertDialog', () => {
  it('asks its question and starts on the primary button', () => {
    render(<Overwrite />);
    const alert = screen.getByRole('alertdialog', {
      name: '‘만복의 근원 하나님’ 곡이 이미 있습니다. 덮어쓸까요?',
      description: '라이브러리 곡 4장, 10월 20일 수정',
    });
    expect(alert.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '덮어쓰기'}),
    );
    expect(screen.queryByRole('button', {name: '닫기'})).toBeNull();
  });

  it('cancels with Esc', async () => {
    const onCancel = vi.fn();
    render(<Overwrite onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('presses the escape action with Esc when there is no 취소', async () => {
    const onRestart = vi.fn();
    const onRestore = vi.fn();
    render(
      <AlertDialog
        icon="history"
        title="출력 상태 복구"
        meta={['비정상 종료', '10월 25일 오전 11:26']}
        actions={[
          {label: '새로 시작', escape: true, onSelect: onRestart},
          {label: '복구', primary: true, onSelect: onRestore},
        ]}
        list={{
          label: '복구할 상태',
          children: (
            <Checkbox aria-label="화면 출력" checked onChange={() => {}} />
          ),
        }}
      />,
    );
    expect(screen.getByRole('group', {name: '복구할 상태'})).toBeDefined();
    await userEvent.keyboard('{Escape}');
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('makes a dialog under it inert while it is open', () => {
    const {rerender} = render(
      <Dialog
        title="편집"
        size="m"
        onCancel={() => {}}
        primary={{label: '저장', onSelect: () => {}}}
      >
        <span>본문</span>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    rerender(
      <>
        <Dialog
          title="편집"
          size="m"
          onCancel={() => {}}
          primary={{label: '저장', onSelect: () => {}}}
        >
          <span>본문</span>
        </Dialog>
        <Overwrite />
      </>,
    );
    expect(dialog.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('alertdialog').closest('[inert]')).toBeNull();
  });
});

describe('enterPressesPrimary', () => {
  it('leaves Enter to buttons, multiline fields, and lists', () => {
    const button = document.createElement('button');
    const textarea = document.createElement('textarea');
    const list = document.createElement('div');
    list.setAttribute('role', 'listbox');
    const option = document.createElement('div');
    list.append(option);
    expect(enterPressesPrimary(button, false)).toBe(false);
    expect(enterPressesPrimary(textarea, false)).toBe(false);
    expect(enterPressesPrimary(option, false)).toBe(false);
  });

  it('presses the primary button from text fields and checkboxes', () => {
    const input = document.createElement('input');
    const checkbox = document.createElement('button');
    checkbox.setAttribute('role', 'checkbox');
    expect(enterPressesPrimary(input, false)).toBe(true);
    expect(enterPressesPrimary(checkbox, true)).toBe(true);
    expect(enterPressesPrimary(input, true)).toBe(false);
  });
});
