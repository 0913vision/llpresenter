import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Panel, Panels} from '@renderer/ui/panels/Panel';
import {PanelFailureContext} from '@renderer/ui/panels/PanelBoundary';

let broken = true;

function Lyrics(): string {
  if (broken) throw new Error('slide list broke');
  return '가사 목록';
}

afterEach(() => {
  broken = true;
  vi.restoreAllMocks();
});

describe('a panel that fails to draw', () => {
  it('shows its failure with 다시 시도, keeps the other panels, and reports it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const report = vi.fn();
    render(
      <PanelFailureContext value={report}>
        <Panels>
          <Panel label="슬라이드">
            <Lyrics />
          </Panel>
          <Panel label="예배 순서">순서 목록</Panel>
        </Panels>
      </PanelFailureContext>,
    );

    expect(screen.getByRole('status').textContent).toContain(
      '슬라이드 표시 실패',
    );
    expect(screen.getByText('순서 목록')).toBeDefined();
    expect(report).toHaveBeenCalledWith('슬라이드', expect.any(Error));

    broken = false;
    fireEvent.click(screen.getByRole('button', {name: '다시 시도'}));

    expect(screen.getByText('가사 목록')).toBeDefined();
    expect(screen.queryByText('슬라이드 표시 실패')).toBeNull();
  });
});
