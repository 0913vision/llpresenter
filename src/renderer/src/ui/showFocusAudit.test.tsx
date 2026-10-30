import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX, type ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useShowKeys} from '@renderer/features/presentation/shortcuts';
import {useClearKeys} from '@renderer/features/presentation/clearKeys';
import {useUiZoomKeys} from '@renderer/app/shell/uiZoomKeys';
import * as clearState from '@renderer/session/clear';
import * as show from '@renderer/session/show';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {CheckRow} from './Checkbox';
import {Dialog} from './Dialog';
import {ListBox, ListRow} from './ListRow';
import {MacroGrid, MacroTile} from './MacroTile';
import {MediaStrip, MediaTile} from './MediaTile';
import {SlideThumbnail, ThumbnailGrid} from './SlideThumbnail';
import {Slider} from './Slider';
import {ShortcutField} from './ShortcutField';
import {SwitchRow} from './Switch';
import {resetTooltips} from './tooltipTesting';

afterEach(() => {
  resetTooltips();
  delete window.llp;
});

function ShowFrame({children}: {readonly children: ReactNode}): JSX.Element {
  useShowKeys();
  useClearKeys();
  useUiZoomKeys();
  return <>{children}</>;
}

describe.each([
  ['CheckRow', 'checkbox', CheckRow],
  ['SwitchRow', 'switch', SwitchRow],
] as const)('Show focus integration audit: %s', (_name, role, Row) => {
  it('keeps focus for a label click and toggles exactly once', async () => {
    const onChange = vi.fn();
    render(
      <ShowFrame>
        <button>이전</button>
        <Row label="이름표" checked={false} onChange={onChange} />
      </ShowFrame>,
    );
    const previous = screen.getByRole('button', {name: '이전'});
    previous.focus();
    await userEvent.click(screen.getByText('이름표'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(document.activeElement).toBe(previous);
  });

  it('keeps text editing focus when the name is clicked', async () => {
    render(
      <ShowFrame>
        <input aria-label="메모" />
        <Row label="이름표" checked={false} onChange={vi.fn()} />
      </ShowFrame>,
    );
    const field = screen.getByRole('textbox');
    field.focus();
    await userEvent.click(screen.getByText('이름표'));
    await userEvent.keyboard('text');
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty('value', 'text');
  });

  it('keeps focus when a label press releases over its control', async () => {
    const onChange = vi.fn();
    render(
      <ShowFrame>
        <button>이전</button>
        <Row label="이름표" checked={false} onChange={onChange} />
      </ShowFrame>,
    );
    const previous = screen.getByRole('button', {name: '이전'});
    previous.focus();
    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: screen.getByText('이름표')},
      {keys: '[/MouseLeft]', target: screen.getByRole(role)},
    ]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(document.activeElement).toBe(previous);
  });

  it('leaves the next Space to Show after a label click from the body', async () => {
    const next = vi
      .spyOn(show, 'outputNext')
      .mockImplementation(() => undefined);
    const onChange = vi.fn();
    render(
      <ShowFrame>
        <Row label="이름표" checked={false} onChange={onChange} />
      </ShowFrame>,
    );
    await userEvent.click(screen.getByText('이름표'));
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard(' ');
    expect(next).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('retains Tab and Space activation after a label click', async () => {
    const onChange = vi.fn();
    render(
      <ShowFrame>
        <button>이전</button>
        <Row label="이름표" checked={false} onChange={onChange} />
      </ShowFrame>,
    );
    screen.getByRole('button', {name: '이전'}).focus();
    await userEvent.click(screen.getByText('이름표'));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole(role));
    await userEvent.keyboard(' ');
    expect(onChange.mock.calls).toEqual([[true], [true]]);
  });

  it('keeps focus without changing a disabled row', async () => {
    const onChange = vi.fn();
    render(
      <ShowFrame>
        <button>이전</button>
        <Row label="이름표" disabled checked={false} onChange={onChange} />
      </ShowFrame>,
    );
    const previous = screen.getByRole('button', {name: '이전'});
    previous.focus();
    await userEvent.click(screen.getByText('이름표'));
    expect(document.activeElement).toBe(previous);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the native label focus in Prep', async () => {
    render(<Row label="이름표" checked={false} onChange={vi.fn()} />);
    await userEvent.click(screen.getByText('이름표'));
    expect(document.activeElement).toBe(screen.getByRole(role));
  });

  it('keeps the native label focus in a Show dialog', async () => {
    render(
      <ShowFrame>
        <Dialog
          title="설정"
          size="s"
          onCancel={vi.fn()}
          primary={{label: '저장', onSelect: vi.fn()}}
        >
          <Row label="이름표" checked={false} onChange={vi.fn()} />
        </Dialog>
      </ShowFrame>,
    );
    await userEvent.click(screen.getByText('이름표'));
    expect(document.activeElement).toBe(screen.getByRole(role));
  });
});

describe('Show key integration audit', () => {
  it('keeps clear and zoom above dialog fields while Ctrl Z never undoes clear', async () => {
    const clear = vi
      .spyOn(clearState, 'clearLayer')
      .mockImplementation(() => undefined);
    const undo = vi
      .spyOn(clearState, 'undoClear')
      .mockImplementation(() => undefined);
    const zoom = vi.fn(() => Promise.resolve(100));
    window.llp = fakeLlpApi({ui: {changeZoom: zoom}});
    render(
      <ShowFrame>
        <Dialog
          title="설정"
          size="s"
          onCancel={vi.fn()}
          primary={{label: '저장', onSelect: vi.fn()}}
        >
          <input aria-label="메모" />
        </Dialog>
      </ShowFrame>,
    );
    const field = screen.getByRole('textbox');
    await userEvent.click(field);
    fireEvent.keyDown(field, {code: 'F1', key: 'F1', isComposing: true});
    fireEvent.keyDown(field, {code: 'Equal', key: '=', ctrlKey: true});
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(clear).toHaveBeenCalledExactlyOnceWith('all');
    expect(zoom).toHaveBeenCalledExactlyOnceWith({type: 'ui.zoomIn'});
    expect(undo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field);
  });

  it.each(['F1', 'Equal'])(
    'keeps the recorder above all Show handlers for %s',
    code => {
      const clear = vi
        .spyOn(clearState, 'clearLayer')
        .mockImplementation(() => undefined);
      const zoom = vi.fn(() => Promise.resolve(100));
      const record = vi.fn();
      window.llp = fakeLlpApi({ui: {changeZoom: zoom}});
      render(
        <ShowFrame>
          <ShortcutField
            aria-label="단축키"
            onRecord={record}
            onCancel={vi.fn()}
          />
        </ShowFrame>,
      );
      fireEvent.keyDown(screen.getByRole('textbox'), {
        code,
        ctrlKey: code === 'Equal',
      });
      expect(record).toHaveBeenCalledOnce();
      expect(clear).not.toHaveBeenCalled();
      expect(zoom).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['ArrowDown', 'openNextItem'],
    ['ArrowUp', 'openPreviousItem'],
  ] as const)('passes Ctrl %s from a slider to %s', async (code, command) => {
    const run = vi.spyOn(show, command).mockImplementation(() => undefined);
    const change = vi.fn();
    render(
      <ShowFrame>
        <Slider
          label="음량"
          min={0}
          max={100}
          value={50}
          onChange={change}
          workspace="show"
        />
      </ShowFrame>,
    );
    await userEvent.tab();
    await userEvent.keyboard(`{Control>}{${code}}{/Control}`);
    expect(run).toHaveBeenCalledOnce();
    expect(change).not.toHaveBeenCalled();
  });

  function liveKeys() {
    const next = vi
      .spyOn(show, 'outputNext')
      .mockImplementation(() => undefined);
    const previous = vi
      .spyOn(show, 'outputPrevious')
      .mockImplementation(() => undefined);
    return {next, previous};
  }

  it('keeps thumbnail Down and Enter local and sends live keys to Show', async () => {
    const {next, previous} = liveKeys();
    const output = vi.fn();
    function Grid() {
      const [selected, select] = useState(0);
      return (
        <ThumbnailGrid
          label="슬라이드"
          workspace="show"
          columns={2}
          selected={selected}
          onSelect={select}
          onOutput={output}
        >
          {[1, 2, 3].map(number => (
            <SlideThumbnail
              key={number}
              number={number}
              text={`줄 ${number}`}
              selected={selected === number - 1}
            />
          ))}
        </ThumbnailGrid>
      );
    }
    render(
      <ShowFrame>
        <Grid />
      </ShowFrame>,
    );
    await userEvent.click(screen.getByRole('option', {name: '1, 줄 1'}));
    output.mockClear();
    await userEvent.keyboard(
      '{ArrowDown}{Enter}{ArrowRight} {PageDown}{ArrowLeft}{PageUp}',
    );
    expect(output).toHaveBeenCalledExactlyOnceWith(2);
    expect(next).toHaveBeenCalledTimes(3);
    expect(previous).toHaveBeenCalledTimes(2);
  });

  it('keeps service list navigation local and sends live keys to Show', async () => {
    const {next, previous} = liveKeys();
    function ServiceList() {
      const [selected, select] = useState<string | undefined>('first');
      return (
        <ListBox
          label="예배 순서"
          workspace="show"
          selected={selected}
          onSelect={select}
        >
          <ListRow value="first" title="첫 항목" />
          <ListRow value="second" title="다음 항목" />
        </ListBox>
      );
    }
    render(
      <ShowFrame>
        <ServiceList />
      </ShowFrame>,
    );
    await userEvent.click(screen.getByRole('option', {name: '첫 항목'}));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '다음 항목'}),
    );
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '첫 항목'}),
    );
    await userEvent.keyboard('{End}{ArrowRight} {PageDown}{ArrowLeft}{PageUp}');
    expect(next).toHaveBeenCalledTimes(3);
    expect(previous).toHaveBeenCalledTimes(2);
  });

  it('clicking a macro leaves Space with Show while Tab grants activation keys', async () => {
    const {next} = liveKeys();
    const run = vi.fn();
    render(
      <ShowFrame>
        <MacroGrid label="매크로" selected={0} onRun={run} onMenu={vi.fn()}>
          <MacroTile name="찬양" icon="song" color="teal" />
        </MacroGrid>
      </ShowFrame>,
    );
    await userEvent.click(screen.getByRole('option'));
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard(' ');
    expect(next).toHaveBeenCalledOnce();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('option'));
    await userEvent.keyboard(' {Enter}');
    expect(run.mock.calls).toEqual([[0], [0], [0]]);
    expect(next).toHaveBeenCalledOnce();
  });

  it('clicking media keeps focus, Enter activates, and Space passes to Show', async () => {
    const {next} = liveKeys();
    const activate = vi.fn();
    render(
      <ShowFrame>
        <MediaStrip
          label="미디어"
          selected={0}
          onSelect={vi.fn()}
          onActivate={activate}
        >
          <MediaTile name="배경" />
        </MediaStrip>
      </ShowFrame>,
    );
    await userEvent.click(screen.getByRole('option'));
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard(' ');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('option'));
    await userEvent.keyboard('{Enter} ');
    expect(activate.mock.calls).toEqual([[0], [0]]);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
