import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {MenuBar} from './MenuBar';

async function openImport(): Promise<void> {
  await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
  await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
}

describe('File menu clipboard availability', () => {
  it('checks when hover switches an open menu and preserves click-after-hover behavior', async () => {
    const query = vi.fn(async () => true);
    render(
      <MenuBar title="" onImportText={vi.fn()} clipboardAvailable={query} />,
    );
    const file = screen.getByRole('menuitem', {name: '파일'});
    await userEvent.hover(file);
    expect(query).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
    await userEvent.hover(file);
    await waitFor(() => expect(query).toHaveBeenCalledOnce());
    expect(screen.getByRole('menu', {name: '파일'})).toBeDefined();
    await userEvent.click(file);
    expect(screen.getByRole('menu', {name: '파일'})).toBeDefined();
    expect(query).toHaveBeenCalledOnce();
  });
  it('disables an empty clipboard and refreshes availability when reopened', async () => {
    const query = vi.fn(async () => false);
    const onImport = vi.fn();
    render(
      <MenuBar title="" onImportText={onImport} clipboardAvailable={query} />,
    );
    await openImport();
    const item = screen.getByRole('menuitem', {name: '클립보드 텍스트…'});
    expect(item.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(item);
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    query.mockResolvedValueOnce(true);
    await openImport();
    const available = screen.getByRole('menuitem', {name: '클립보드 텍스트…'});
    await waitFor(() =>
      expect(available.getAttribute('aria-disabled')).not.toBe('true'),
    );
    fireEvent.click(available);
    expect(onImport).toHaveBeenCalledExactlyOnceWith('clipboard');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('keeps at most one pending query across rapid reopenings', async () => {
    let resolve: (value: boolean) => void = () => undefined;
    const query = vi.fn(
      () =>
        new Promise<boolean>(finish => {
          resolve = finish;
        }),
    );
    render(
      <MenuBar title="" onImportText={vi.fn()} clipboardAvailable={query} />,
    );
    for (let index = 0; index < 20; index++) {
      fireEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    }
    await openImport();
    expect(query).toHaveBeenCalledOnce();
    expect(
      screen
        .getByRole('menuitem', {name: '클립보드 텍스트…'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await act(async () => resolve(true));
    expect(
      screen
        .getByRole('menuitem', {name: '클립보드 텍스트…'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
  });

  it('keeps clipboard import disabled on failure and ignores replies after unmount', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const query = vi.fn(async () => {
      throw new Error('Unavailable');
    });
    const view = render(
      <MenuBar title="" onImportText={vi.fn()} clipboardAvailable={query} />,
    );
    await openImport();
    await waitFor(() => expect(console.error).toHaveBeenCalledOnce());
    expect(
      screen
        .getByRole('menuitem', {name: '클립보드 텍스트…'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    view.unmount();
    let resolve: (value: boolean) => void = () => undefined;
    const onImport = vi.fn();
    const late = render(
      <MenuBar
        title=""
        onImportText={onImport}
        clipboardAvailable={() =>
          new Promise(finish => {
            resolve = finish;
          })
        }
      />,
    );
    await openImport();
    late.unmount();
    await act(async () => resolve(true));
    expect(onImport).not.toHaveBeenCalled();
  });
});
