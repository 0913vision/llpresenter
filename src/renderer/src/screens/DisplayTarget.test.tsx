import {type JSX} from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {classNames} from '@renderer/ui/classNames';
import type {TargetBox} from './layoutBoxes';
import {DisplayTarget} from './DisplayTarget';
import {useScreensSelection} from './selection';

vi.mock('@renderer/ui/classNames', async importOriginal => {
  const original =
    await importOriginal<typeof import('@renderer/ui/classNames')>();
  return {classNames: vi.fn(original.classNames)};
});

afterEach(() => {
  cleanup();
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
});

it('redraws only the changed target when a different screen is selected', () => {
  const renders = vi.mocked(classNames);
  const targets: readonly TargetBox[] = Array.from(
    {length: 200},
    (_, index) => ({
      id: `screen-${index}`,
      name: `Screen ${index}`,
      detail: 'NDI',
      resolution: undefined,
      selected: index === 0,
    }),
  );
  const rows = (selected: number): JSX.Element => (
    <>
      {targets.map((target, index) => (
        <DisplayTarget
          key={target.id}
          {...target}
          selected={index === selected}
        />
      ))}
    </>
  );
  const view = render(rows(0));
  expect(renders).toHaveBeenCalledTimes(200);
  renders.mockClear();
  view.rerender(rows(1));
  expect(renders).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole('button', {name: 'Screen 1'}).getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: 'Screen 2'}));
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'screen',
    id: 'screen-2',
  });
});

it('updates a target when its screen details change', () => {
  const target: TargetBox = {
    id: 'screen-1',
    name: 'Screen',
    detail: 'NDI',
    resolution: undefined,
    selected: false,
  };
  const view = render(<DisplayTarget {...target} />);
  view.rerender(
    <DisplayTarget
      {...target}
      name="Renamed"
      detail="Window"
      resolution="1920?1080"
    />,
  );
  const button = screen.getByRole('button', {name: 'Renamed'});
  expect(button.textContent).toContain('Window');
  expect(button.textContent).toContain('1920?1080');
});
