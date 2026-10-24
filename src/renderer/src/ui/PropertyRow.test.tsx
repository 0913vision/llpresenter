import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it} from 'vitest';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from './PropertyRow';
import {Switch} from './Switch';
import {TextField} from './TextField';

function ScreenSettings(): JSX.Element {
  const [onTop, setOnTop] = useState(false);
  const [name, setName] = useState('본 화면');
  return (
    <Properties>
      <PropertyGroup title="안정성">
        <PropertyRow label="항상 위">
          {id => <Switch id={id} checked={onTop} onChange={setOnTop} />}
        </PropertyRow>
        <PropertyRow label="이름">
          {id => <TextField id={id} value={name} onChange={setName} />}
        </PropertyRow>
        <PropertyValue label="주사율" value="60Hz" />
      </PropertyGroup>
    </Properties>
  );
}

describe('PropertyRow', () => {
  it('names its control after the row name', () => {
    render(<ScreenSettings />);
    expect(screen.getByRole('switch', {name: '항상 위'})).toBeDefined();
    expect(screen.getByRole('textbox', {name: '이름'})).toBeDefined();
  });

  it('toggles a switch from a press on the name', async () => {
    render(<ScreenSettings />);
    await userEvent.click(screen.getByText('항상 위'));
    expect(
      screen
        .getByRole('switch', {name: '항상 위'})
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

  it('groups rows under a named group', () => {
    render(<ScreenSettings />);
    expect(screen.getByRole('group', {name: '안정성'})).toBeDefined();
  });

  it('shows a read-only value next to its name', () => {
    render(<ScreenSettings />);
    const row = screen.getByRole('group', {name: '주사율'});
    expect(row.textContent).toBe('주사율60Hz');
  });

  it('shows extra information after a value', () => {
    render(
      <PropertyValue
        label="원본"
        value="만복의 근원 하나님"
        icon="link"
        primary
        meta="라이브러리"
      />,
    );
    expect(screen.getByText('라이브러리')).toBeDefined();
  });
});
