import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it} from 'vitest';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {Checkbox} from '@renderer/ui/Checkbox';
import {TextField} from '@renderer/ui/TextField';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(resetTooltips);

function ScreenSettings(): JSX.Element {
  const [onTop, setOnTop] = useState(false);
  const [name, setName] = useState('청중 화면');
  const [kind, setKind] = useState<'audience' | 'stage'>('stage');
  return (
    <Properties>
      <PropertyGroup title="안정성">
        <PropertyRow label="항상 위">
          {({controlId}) => (
            <Checkbox id={controlId} checked={onTop} onChange={setOnTop} />
          )}
        </PropertyRow>
        <PropertyRow label="이름">
          {({controlId}) => (
            <TextField id={controlId} value={name} onChange={setName} />
          )}
        </PropertyRow>
        <PropertyRow label="종류">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              labelledBy={labelId}
              options={[
                {value: 'audience', label: '청중'},
                {value: 'stage', label: '무대'},
              ]}
              value={kind}
              onChange={setKind}
            />
          )}
        </PropertyRow>
        <PropertyValue label="주사율" value="60Hz" />
      </PropertyGroup>
    </Properties>
  );
}

describe('PropertyRow', () => {
  it('toggles a switch from a press on the name', async () => {
    render(<ScreenSettings />);
    await userEvent.click(screen.getByText('항상 위'));
    expect(
      screen
        .getByRole('checkbox', {name: '항상 위'})
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('focuses a text field from a press on the name', async () => {
    render(<ScreenSettings />);
    await userEvent.click(screen.getByText('이름'));
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', {name: '이름'}),
    );
  });

  it('names a group control after the row name', () => {
    render(<ScreenSettings />);
    expect(screen.getByRole('radiogroup', {name: '종류'})).toBeDefined();
  });

  it('focuses the Tab stop of a group control from a press on the name', async () => {
    render(<ScreenSettings />);
    await userEvent.click(screen.getByText('종류'));
    expect(document.activeElement).toBe(
      screen.getByRole('radio', {name: '무대'}),
    );
  });

  it('shows a read-only value next to its name', () => {
    render(<ScreenSettings />);
    const row = screen.getByRole('group', {name: '주사율'});
    expect(row.textContent).toBe('주사율60Hz');
  });
});
