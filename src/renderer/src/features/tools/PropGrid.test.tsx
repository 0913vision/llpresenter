import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {parseProps} from '@core/schema/props';
import {useLive} from '@renderer/session/live';
import {PropGrid} from './PropGrid';
import {stageFixture} from './stageTesting';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const parsed = parseProps(
  JSON.stringify({
    format: 'llsettings.props',
    schemaVersion: 1,
    props: [
      {
        id: first,
        name: '안내',
        content: {
          kind: 'text',
          text: '환영',
          style: {
            font: 'Pretendard',
            weight: 600,
            color: '#FFFFFF',
            size: 64,
            lineHeight: 1.2,
            align: 'center',
            vAlign: 'bottom',
            maxLines: 1,
            margin: 4,
            shadow: true,
            outline: false,
          },
        },
        targets: [],
      },
      {
        id: second,
        name: '로고',
        content: {kind: 'image', media: first},
        targets: [],
      },
    ],
  }),
  'props.json',
);
if (!parsed.ok) throw new Error('Invalid prop fixture');
const props = parsed.value.data.props;

afterEach(() => {
  cleanup();
  delete window.llp;
});

it('shows prop contents and activates tiles with keyboard and mouse', () => {
  const fixture = stageFixture();
  render(<PropGrid props={props} screens={[]} />);
  expect(screen.getByText('환영')).toBeTruthy();
  const firstTile = screen.getByRole('option', {name: '안내'});
  firstTile.focus();
  fireEvent.keyDown(firstTile, {key: 'Enter'});
  fireEvent.keyUp(firstTile, {key: 'Enter'});
  fireEvent.click(screen.getByRole('option', {name: '로고'}));
  expect(fixture.send.mock.calls.map(([command]) => command)).toEqual([
    {type: 'prop.set', propId: first, on: true},
    {type: 'prop.set', propId: second, on: true},
  ]);
});

it('reflects live state and reads the latest state when toggled', () => {
  const fixture = stageFixture();
  render(<PropGrid props={props} screens={[]} />);
  const state = useLive.getState().state;
  if (!state) throw new Error('Missing live state');
  act(() => {
    useLive.setState({
      state: {...state, layers: {...state.layers, prop: {propId: first}}},
    });
  });
  const tile = screen.getByRole('option', {name: '안내'});
  expect(tile.getAttribute('data-state')).toContain('live');
  fireEvent.click(tile);
  expect(fixture.send.mock.calls[0]?.[0]).toEqual({
    type: 'prop.set',
    propId: first,
    on: false,
  });
});

it('moves focus between tiles without activating either one', () => {
  const fixture = stageFixture();
  render(<PropGrid props={props} screens={[]} />);
  const firstTile = screen.getByRole('option', {name: '안내'});
  const secondTile = screen.getByRole('option', {name: '로고'});
  firstTile.focus();
  fireEvent.keyDown(firstTile, {key: 'ArrowRight'});
  expect(document.activeElement).toBe(secondTile);
  expect(fixture.send).not.toHaveBeenCalled();
});
