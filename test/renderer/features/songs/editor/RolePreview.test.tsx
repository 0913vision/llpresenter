import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import type {PreviewRole} from '@renderer/features/songs/editor/songPreviewModel';

afterEach(cleanup);

function Preview({
  onRoom,
}: {
  readonly onRoom: (room: boolean) => void;
}): JSX.Element {
  const [big, setBig] = useState<PreviewRole>('audience');
  return (
    <RolePreview
      big={big}
      onBigChange={setBig}
      onRoom={onRoom}
      renderRole={role => <span>{`그림 ${role}`}</span>}
      caption={role => <span>{`자막 ${role}`}</span>}
    >
      <div data-preview-extra="">여분</div>
    </RolePreview>
  );
}

describe('RolePreview', () => {
  it('shows the chosen screen large and the other two as tiles, one picture each', () => {
    const onRoom = vi.fn();
    const {container} = render(<Preview onRoom={onRoom} />);

    expect(
      container
        .querySelector('[data-role="large"]')
        ?.getAttribute('data-screen'),
    ).toBe('audience');
    expect(
      screen
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['무대 화면 크게 보기', '방송 화면 크게 보기']);
    expect(container.querySelectorAll('[data-screen]')).toHaveLength(3);
    expect(screen.getByText('자막 audience')).toBeDefined();
    expect(screen.getByText('여분')).toBeDefined();
    expect(onRoom).toHaveBeenLastCalledWith(true);
  });

  it('swaps a clicked tile with the large picture and keeps the pictures mounted', () => {
    const {container} = render(<Preview onRoom={() => {}} />);
    const pictures = [...container.querySelectorAll('[data-screen]')];

    fireEvent.click(screen.getByRole('button', {name: '방송 화면 크게 보기'}));

    expect(
      container
        .querySelector('[data-role="large"]')
        ?.getAttribute('data-screen'),
    ).toBe('broadcast');
    expect(screen.getByText('자막 broadcast')).toBeDefined();
    expect(
      screen
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['청중 화면 크게 보기', '무대 화면 크게 보기']);
    expect([...container.querySelectorAll('[data-screen]')]).toEqual(pictures);
  });
});
