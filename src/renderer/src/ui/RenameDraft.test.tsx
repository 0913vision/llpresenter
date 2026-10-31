import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {useState} from 'react';
import {expect, it, vi} from 'vitest';
import {NameField} from './ListRow';
import type {RenameContract} from './useRenameDraft';
import {RenameDialog} from './RenameDialog';

function Harness({save}: {readonly save: RenameContract['onCommit']}) {
  const [open, setOpen] = useState(true);
  return open ? (
    <NameField
      label="기존 이름"
      rename={{
        validate: name => (name === '' ? '이름 필요' : undefined),
        onCommit: save,
        onClose: () => setOpen(false),
      }}
    />
  ) : (
    <span>닫힘</span>
  );
}

it('lets a valid modal draft retry from its save button after failure', async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const close = vi.fn();
  render(
    <RenameDialog
      name="기존"
      title="이름 바꾸기"
      rename={{onCommit: save, onClose: close}}
    />,
  );
  fireEvent.change(screen.getByRole('textbox'), {target: {value: '새 이름'}});
  const button = screen.getByRole('button', {name: '저장'});
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe(
      'true',
    ),
  );
  expect(button.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(button);
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(save).toHaveBeenCalledTimes(2);
});

it('shows a rejected save without losing the draft', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    render(<Harness save={() => Promise.reject(Error('Invented failure'))} />);
    const field = screen.getByRole('textbox');
    fireEvent.change(field, {target: {value: '새 이름'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() =>
      expect(field.getAttribute('aria-invalid')).toBe('true'),
    );
    expect(screen.getByDisplayValue('새 이름')).toBe(field);
    expect(log).toHaveBeenCalledOnce();
  } finally {
    log.mockRestore();
  }
});

it('keeps the typed draft through a pending and refused save, then retries', async () => {
  let resolveSave: (saved: boolean) => void = () => {};
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          resolveSave = resolve;
        }),
    )
    .mockResolvedValueOnce(true);
  render(<Harness save={save} />);
  const field = screen.getByRole('textbox');
  fireEvent.change(field, {target: {value: '새 이름'}});
  fireEvent.keyDown(field, {key: 'Enter'});
  fireEvent.blur(field);
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByDisplayValue('새 이름')).toBe(field);
  expect(field.hasAttribute('readonly')).toBe(true);
  resolveSave(false);
  await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
  expect(screen.getByDisplayValue('새 이름')).toBe(field);
  fireEvent.keyDown(field, {key: 'Enter'});
  await screen.findByText('닫힘');
  expect(save).toHaveBeenCalledTimes(2);
});

it.each(['Enter', 'blur', 'reverted draft'])(
  'requires persistence after failure and a published name update on %s',
  async action => {
    const save = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const close = vi.fn();
    const rename = {onCommit: save, onClose: close};
    const view = render(
      <RenameDialog name="기존" title="이름 바꾸기" rename={rename} />,
    );
    const field = screen.getByRole('textbox');
    fireEvent.change(field, {target: {value: '새 이름'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() =>
      expect(field.getAttribute('aria-invalid')).toBe('true'),
    );
    view.rerender(
      <RenameDialog name="새 이름" title="이름 바꾸기" rename={rename} />,
    );
    if (action === 'reverted draft') {
      fireEvent.change(field, {target: {value: '기존'}});
    }
    if (action === 'blur') fireEvent.blur(field);
    else fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(
      action === 'reverted draft' ? '기존' : '새 이름',
    );
  },
);

it.each(['Enter', 'Escape', 'valid blur', 'invalid blur', 'unchanged'])(
  'handles %s with the shared commit/cancel contract',
  async action => {
    const save = vi.fn().mockResolvedValue(true);
    render(<Harness save={save} />);
    const field = screen.getByRole('textbox');
    const value =
      action === 'invalid blur'
        ? ''
        : action === 'unchanged'
          ? ' 기존 이름 '
          : '새 이름';
    fireEvent.change(field, {target: {value}});
    if (action.includes('blur')) fireEvent.blur(field);
    else {
      fireEvent.keyDown(field, {key: action === 'Escape' ? 'Escape' : 'Enter'});
    }
    await screen.findByText('닫힘');
    expect(save).toHaveBeenCalledTimes(
      action === 'Enter' || action === 'valid blur' ? 1 : 0,
    );
  },
);
