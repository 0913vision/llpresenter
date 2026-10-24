import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from './PropertyRow';
import {SegmentedControl} from './SegmentedControl';
import {Switch} from './Switch';
import {TextField} from './TextField';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

function ScreenSettings(): JSX.Element {
  const [onTop, setOnTop] = useState(false);
  const [name, setName] = useState('본 화면');
  const [kind, setKind] = useState<'audience' | 'stage'>('stage');
  return (
    <Properties>
      <PropertyGroup title="안정성">
        <PropertyRow label="항상 위">
          {({controlId}) => (
            <Switch id={controlId} checked={onTop} onChange={setOnTop} />
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

  it('groups rows under a named group', () => {
    render(<ScreenSettings />);
    expect(screen.getByRole('group', {name: '안정성'})).toBeDefined();
  });

  it('cuts a long value off with an ellipsis and shows it in full in a tooltip', async () => {
    const path = 'D:\\예배 미디어\\배경\\아주 긴 이름의 배경 영상 파일.mp4';
    render(<PropertyValue label="원본" value={path} />);
    const text = screen.getByText(path);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    expect((await hoverForTooltip(text))?.textContent).toBe(path);
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
