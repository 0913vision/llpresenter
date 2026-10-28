import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {SubmitEvent} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Button} from './Button';
import {ClearButton} from './ClearButton';
import {IconButton} from './IconButton';
import {ListActionRow} from './ListRow';
import {OutputToggle} from './OutputToggle';
import {PanelSwitch} from './Panel';
import {Select} from './Select';
import {ToolbarButton} from './ToolbarButton';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

const controls = [
  {
    name: 'button',
    render: (press: () => void) => (
      <Button title="설명" onClick={press}>
        선택
      </Button>
    ),
  },
  {
    name: 'icon',
    render: (press: () => void) => (
      <IconButton icon="plus" label="선택" onClick={press} />
    ),
  },
  {
    name: 'toolbar',
    render: (press: () => void) => (
      <ToolbarButton icon="media" label="선택" title="설명" onClick={press} />
    ),
  },
  {
    name: 'output',
    render: (press: () => void) => (
      <OutputToggle
        icon="screen"
        label="선택"
        target="창"
        state="off"
        onToggle={press}
      />
    ),
  },
  {
    name: 'clear',
    render: (press: () => void) => (
      <ClearButton layer="slide" active onClear={press} />
    ),
    label: '가사 지우기',
  },
  {
    name: 'action row',
    render: (press: () => void) => (
      <ListActionRow title="선택" reason="설명" onPress={press} />
    ),
  },
  {
    name: 'select',
    render: (press: () => void) => (
      <Select
        value="선택"
        title="설명"
        expanded={false}
        onExpandedChange={press}
      />
    ),
  },
  {
    name: 'panel switch',
    render: (press: () => void) => (
      <PanelSwitch
        value="선택"
        title="설명"
        expanded={false}
        onExpandedChange={press}
      />
    ),
  },
];

describe.each(controls)(
  '$name keyboard activation',
  ({render: view, label}) => {
    it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey'] as const)(
      'does not activate with %s plus Space or Enter',
      modifier => {
        const press = vi.fn();
        render(view(press));
        const button = screen.getByRole('button', {name: label ?? '선택'});
        for (const key of [' ', 'Enter']) {
          const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
            [modifier]: true,
          });
          fireEvent(button, event);
          expect(event.defaultPrevented).toBe(false);
          if (key === ' ') fireEvent.keyUp(button, {key});
          fireEvent.click(button, {detail: 0});
          expect(press).not.toHaveBeenCalled();
        }
        fireEvent.click(button, {detail: 1, [modifier]: true});
        expect(press).toHaveBeenCalledTimes(1);
      },
    );

    it('still activates with unmodified Space and Enter', async () => {
      const press = vi.fn();
      render(view(press));
      await userEvent.tab();
      await userEvent.keyboard(' {Enter}');
      expect(press).toHaveBeenCalledTimes(2);
    });

    it('dismisses its tooltip on blur', async () => {
      render(view(() => {}));
      const button = screen.getByRole('button', {name: label ?? '선택'});
      expect(await hoverForTooltip(button)).not.toBeNull();
      fireEvent.blur(button);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  },
);

it('does not submit a form from a modified keyboard activation', () => {
  const submit = vi.fn((event: SubmitEvent<HTMLFormElement>) =>
    event.preventDefault(),
  );
  render(
    <form onSubmit={submit}>
      <Button type="submit">저장</Button>
    </form>,
  );
  const button = screen.getByRole('button', {name: '저장'});
  fireEvent.keyDown(button, {key: 'Enter', ctrlKey: true});
  fireEvent.click(button, {detail: 0});
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(button, {detail: 1});
  expect(submit).toHaveBeenCalledOnce();
});
