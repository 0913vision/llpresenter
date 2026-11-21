import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it} from 'vitest';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import {createScreenId} from '@core/schema/ids';
import type {Screen} from '@core/schema/screens';

const screens: Screen[] = [
  {
    id: createScreenId('00000000-0000-4000-8000-000000000001'),
    name: '청중 화면',
    kind: 'audience',
    method: 'fullscreen',
  },
  {
    id: createScreenId('00000000-0000-4000-8000-000000000002'),
    name: '무대 화면',
    kind: 'stage',
    method: 'fullscreen',
  },
  {
    id: createScreenId('00000000-0000-4000-8000-000000000003'),
    name: '방송 화면',
    kind: 'broadcast',
    method: 'capture',
  },
];

afterEach(cleanup);

function Preview(): JSX.Element {
  const [big, setBig] = useState<string | null>(null);
  return (
    <RolePreview
      screens={screens}
      big={big}
      onBigChange={setBig}
      renderScreen={target => <span>{`picture ${target.kind}`}</span>}
    >
      <div data-preview-extra="">여분</div>
    </RolePreview>
  );
}

describe('RolePreview', () => {
  it('uses the shared single-screen picker without changing the selection mode', () => {
    const {container} = render(<Preview />);
    fireEvent.click(screen.getByRole('radio', {name: '한 화면'}));
    expect(container.querySelectorAll('[data-preview-slot]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('radio', {name: '무대 화면'}));
    expect(
      container
        .querySelector('[data-role="large"]')
        ?.getAttribute('data-screen'),
    ).toBe(screens[1]?.id);
    expect(
      screen.getByRole('radio', {name: '한 화면'}).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('radio', {name: '세 화면'}));
    expect(container.querySelectorAll('[data-preview-slot]')).toHaveLength(2);
  });
  it('shows the chosen screen large and the other two as tiles, one picture each', () => {
    const {container} = render(<Preview />);

    expect(
      container
        .querySelector('[data-role="large"]')
        ?.getAttribute('data-screen'),
    ).toBe(screens[0]?.id);
    expect(
      screen
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['무대 화면 크게 보기', '방송 화면 크게 보기']);
    expect(container.querySelectorAll('[data-screen]')).toHaveLength(3);
    expect(screen.getByText('picture audience')).toBeDefined();
    expect(screen.getByText('여분')).toBeDefined();
  });

  it('swaps a clicked tile with the large picture and keeps the pictures mounted', () => {
    const {container} = render(<Preview />);
    const pictures = [...container.querySelectorAll('[data-screen]')];

    fireEvent.click(screen.getByRole('button', {name: '방송 화면 크게 보기'}));

    expect(
      container
        .querySelector('[data-role="large"]')
        ?.getAttribute('data-screen'),
    ).toBe(screens[2]?.id);
    expect(screen.getByText('picture broadcast')).toBeDefined();
    expect(
      screen
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label')),
    ).toEqual(['청중 화면 크게 보기', '무대 화면 크게 보기']);
    expect([...container.querySelectorAll('[data-screen]')]).toEqual(pictures);
  });
});

it('keeps distinct configured screens of the same kind mounted when promoted', () => {
  const first = screens[0];
  if (first === undefined) throw new Error('Missing screen');
  const second = {
    ...first,
    id: createScreenId('00000000-0000-4000-8000-000000000004'),
    name: 'Second audience',
  };
  function DuplicateScreens(): JSX.Element {
    const [big, setBig] = useState<string | null>(null);
    return (
      <RolePreview
        screens={[first, second]}
        big={big}
        onBigChange={setBig}
        renderScreen={target => <span>{target.id}</span>}
      />
    );
  }
  const {container} = render(<DuplicateScreens />);
  const before = [...container.querySelectorAll('[data-screen]')];
  expect(before).toHaveLength(2);
  fireEvent.click(
    screen.getByRole('button', {name: 'Second audience 크게 보기'}),
  );
  expect(
    container.querySelector('[data-role="large"]')?.getAttribute('data-screen'),
  ).toBe(second.id);
  expect([...container.querySelectorAll('[data-screen]')]).toEqual(before);
});

it('renders no phantom screen for an empty configuration', () => {
  const {container} = render(
    <RolePreview
      screens={[]}
      big={null}
      onBigChange={() => undefined}
      renderScreen={() => <span>picture</span>}
    />,
  );
  expect(container.querySelector('[data-screen]')).toBeNull();
});
