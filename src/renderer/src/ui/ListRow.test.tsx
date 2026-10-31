import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {CLICK_FOCUS_SELECTOR} from './clickFocus';
import {IconButton} from './IconButton';
import {
  ListActionRow,
  ListBox,
  ListDragGhost,
  ListGroup,
  ListRow,
  ListSlot,
} from './ListRow';
import {pointAway, hoverForTooltip, resetTooltips} from './tooltipTesting';
import {passedKeys, recordWindowKeys} from './windowKeysTesting';
import type {Workspace} from './workspace';

afterEach(resetTooltips);

function ServiceOrder({
  initial,
  onSelect = () => {},
  onDismiss = () => {},
  workspace,
}: {
  readonly initial?: string;
  readonly onSelect?: (value: string) => void;
  readonly onDismiss?: () => void;
  readonly workspace?: Workspace;
}): JSX.Element {
  const [selected, setSelected] = useState<string | undefined>(initial);
  return (
    <ListBox
      label="예배 순서"
      selected={selected}
      workspace={workspace}
      onSelect={value => {
        setSelected(value);
        onSelect(value);
      }}
    >
      <ListGroup label="예배 전">
        <ListRow
          value="count"
          icon="film"
          title="예배 전 카운트다운"
          meta="5:00"
          done
        />
      </ListGroup>
      <ListGroup label="찬양">
        <ListRow
          value="hymn1"
          icon="song"
          title="만복의 근원 하나님"
          meta="슬라이드 9개"
          live
        />
        <ListRow
          value="hymn2"
          icon="song"
          title="내 주를 가까이 하게 함은"
          meta="주일용"
          disabled
          reason="라이브러리에 없는 곡입니다"
        />
        <ListRow
          value="hymn3"
          icon="song"
          title="주 하나님 지으신 모든 세계"
          warning="미디어 파일 없음"
          end={<IconButton icon="x" label="내리기" onClick={onDismiss} />}
        />
      </ListGroup>
    </ListBox>
  );
}

function selectedTitle(): string | undefined {
  return (
    screen
      .getAllByRole('option')
      .find(option => option.getAttribute('aria-selected') === 'true')
      ?.getAttribute('data-value') ?? undefined
  );
}

type RowChange = 'remove' | 'disable' | 'enable' | 'insert';

function ChangingRows({change}: {readonly change: RowChange}): JSX.Element {
  const [changed, setChanged] = useState(false);
  const showFirst =
    change === 'remove' ? !changed : change !== 'insert' || changed;
  const disableFirst =
    (change === 'disable' && changed) || (change === 'enable' && !changed);
  return (
    <ListGroup label="찬양">
      {showFirst ? (
        <ListRow value="hymn" title="찬양" disabled={disableFirst} />
      ) : null}
      <ListRow
        value="notice"
        title="광고"
        end={
          <IconButton
            icon="refresh"
            label="목록 변경"
            onClick={() => setChanged(value => !value)}
          />
        }
      />
    </ListGroup>
  );
}

describe('ListBox and ListRow', () => {
  it('exposes externally controlled multiple selection while retaining the list cursor', () => {
    render(
      <ListBox multiple label="Elements" selected="first" onSelect={vi.fn()}>
        <ListRow value="first" title="First" selected />
        <ListRow value="second" title="Second" selected />
      </ListBox>,
    );
    expect(
      screen.getByRole('listbox').getAttribute('aria-multiselectable'),
    ).toBe('true');
    expect(
      screen
        .getAllByRole('option')
        .every(row => row.getAttribute('aria-selected') === 'true'),
    ).toBe(true);
    expect(screen.getByRole('option', {name: 'First'}).tabIndex).toBe(0);
    expect(screen.getByRole('option', {name: 'Second'}).tabIndex).toBe(-1);
  });
  it('selects empty sections by pointer and keyboard as insertion targets', async () => {
    const onSelect = vi.fn();
    render(
      <ListBox label="예배 순서" selected={undefined} onSelect={onSelect}>
        <ListGroup label="빈 구역" value="empty">
          {null}
        </ListGroup>
        <ListGroup label="다음 구역" value="next">
          <ListRow value="song" title="첫 곡" />
        </ListGroup>
      </ListBox>,
    );
    const empty = screen.getByRole('option', {name: '빈 구역'});
    await userEvent.click(empty);
    expect(onSelect).toHaveBeenLastCalledWith('empty');
    empty.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('next');
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('song');
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(empty);
    expect(onSelect).toHaveBeenLastCalledWith('empty');
  });

  it.each(['show', 'prep'] as const)(
    'keeps Tab entry and arrow selection in the %s focus appearance',
    async workspace => {
      const onSelect = vi.fn();
      render(<ServiceOrder workspace={workspace} onSelect={onSelect} />);
      expect(screen.getByRole('listbox').dataset['workspace']).toBe(workspace);
      await userEvent.tab();
      expect(document.activeElement?.getAttribute('data-value')).toBe('count');
      await userEvent.keyboard('{ArrowDown}');
      expect(document.activeElement?.getAttribute('data-value')).toBe('hymn1');
      expect(selectedTitle()).toBe('hymn1');
      expect(onSelect).toHaveBeenCalledWith('hymn1');
    },
  );

  it('is a named list box of named options in named groups', () => {
    render(<ServiceOrder />);
    expect(screen.getByRole('listbox', {name: '예배 순서'})).toBeDefined();
    expect(screen.getByRole('group', {name: '찬양'})).toBeDefined();
    expect(
      screen.getByRole('option', {name: '만복의 근원 하나님'}),
    ).toBeDefined();
  });

  it('keeps group actions outside the accessible group name', async () => {
    const action = vi.fn();
    render(
      <ListBox label="Screens" selected="main" onSelect={vi.fn()}>
        <ListGroup
          label="Audience"
          actions={<button onClick={action}>Add screen</button>}
        >
          <ListRow value="main" title="Main" />
        </ListGroup>
      </ListBox>,
    );
    expect(screen.getByRole('group', {name: 'Audience'})).toBeDefined();
    await userEvent.click(screen.getByRole('button', {name: 'Add screen'}));
    expect(action).toHaveBeenCalledOnce();
  });

  it('preserves selectable group headers when actions are present', async () => {
    const select = vi.fn();
    const action = vi.fn();
    render(
      <ListBox label="Groups" selected={undefined} onSelect={select}>
        <ListGroup
          label="Audience"
          value="audience"
          actions={<button onClick={action}>Add screen</button>}
        >
          <ListRow value="main" title="Main" />
        </ListGroup>
      </ListBox>,
    );
    expect(screen.getByRole('group', {name: 'Audience'})).toBeDefined();
    await userEvent.click(screen.getByRole('option', {name: 'Audience'}));
    expect(select).toHaveBeenLastCalledWith('audience');
    await userEvent.click(screen.getByRole('button', {name: 'Add screen'}));
    expect(action).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledOnce();
  });

  it('selects a row on click', async () => {
    const onSelect = vi.fn();
    render(<ServiceOrder onSelect={onSelect} />);
    await userEvent.click(
      screen.getByRole('option', {name: '만복의 근원 하나님'}),
    );
    expect(onSelect).toHaveBeenCalledWith('hymn1');
    expect(selectedTitle()).toBe('hymn1');
  });

  it('keeps focus on a click in 진행', () => {
    render(<ServiceOrder />);
    const row = screen.getByRole('option', {name: '만복의 근원 하나님'});
    expect(row.closest(CLICK_FOCUS_SELECTOR)).toBe(
      screen.getByRole('listbox', {name: '예배 순서'}),
    );
  });

  it('moves and selects with the arrows, skipping disabled rows', async () => {
    render(<ServiceOrder initial="count" />);
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('data-value')).toBe('count');
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedTitle()).toBe('hymn1');
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedTitle()).toBe('hymn3');
    await userEvent.keyboard('{Home}');
    expect(selectedTitle()).toBe('count');
    await userEvent.keyboard('{End}');
    expect(selectedTitle()).toBe('hymn3');
  });

  it('enters on the first row when nothing is selected', async () => {
    render(<ServiceOrder />);
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('data-value')).toBe('count');
  });

  it('lets Shift Tab leave the list before anything is selected', async () => {
    render(
      <>
        <button type="button">앞</button>
        <ServiceOrder />
        <button type="button">뒤</button>
      </>,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('data-value')).toBe('count');
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '앞'}),
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '내리기'}),
    );
  });

  it.each([
    {change: 'remove', first: 'notice'},
    {change: 'disable', first: 'notice'},
    {change: 'enable', first: 'hymn'},
    {change: 'insert', first: 'hymn'},
  ] as const)(
    'keeps Tab entry when descendant rows $change without rendering ListBox',
    async ({change, first}) => {
      const onSelect = vi.fn();
      render(
        <>
          <button type="button">앞</button>
          <ListBox label="예배 순서" selected={undefined} onSelect={onSelect}>
            <ChangingRows change={change} />
          </ListBox>
          <button type="button">뒤</button>
        </>,
      );
      await userEvent.click(screen.getByRole('button', {name: '목록 변경'}));
      await userEvent.click(screen.getByRole('button', {name: '앞'}));
      await userEvent.tab();
      const firstRow = screen
        .getAllByRole('option')
        .find(row => row.dataset['value'] === first);
      expect(document.activeElement).toBe(firstRow);
      expect(
        screen.getAllByRole('option').filter(row => row.tabIndex === 0),
      ).toEqual([firstRow]);
      await userEvent.tab({shift: true});
      expect(document.activeElement).toBe(
        screen.getByRole('button', {name: '앞'}),
      );
      expect(onSelect).not.toHaveBeenCalled();
    },
  );

  it('does not select a disabled row and gives the reason as a tooltip', async () => {
    const onSelect = vi.fn();
    render(<ServiceOrder onSelect={onSelect} />);
    const disabled = screen.getByRole('option', {
      name: '내 주를 가까이 하게 함은',
    });
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(disabled);
    expect(onSelect).not.toHaveBeenCalled();
    pointAway(disabled);
    expect((await hoverForTooltip(disabled))?.textContent).toBe(
      '라이브러리에 없는 곡입니다',
    );
  });

  it('shows LIVE instead of the extra information on a live row', () => {
    render(<ServiceOrder />);
    const live = screen.getByRole('option', {name: '만복의 근원 하나님'});
    expect(live.getAttribute('data-state')).toBe('live');
    expect(live.textContent).toBe('만복의 근원 하나님LIVE');
  });

  it('marks a past item and a problem with its reason', () => {
    render(<ServiceOrder />);
    expect(
      screen
        .getByRole('option', {name: '예배 전 카운트다운'})
        .getAttribute('data-state'),
    ).toBe('done');
    expect(screen.getByRole('img', {name: '미디어 파일 없음'})).toBeDefined();
  });

  it('keeps a click on an end control from selecting the row', async () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    render(<ServiceOrder onSelect={onSelect} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', {name: '내리기'}));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps row keys on an end control from moving or selecting the row', async () => {
    const onSelect = vi.fn();
    render(<ServiceOrder onSelect={onSelect} />);
    screen.getByRole('button', {name: '내리기'}).focus();
    await userEvent.keyboard('{ArrowUp}{Home}{End}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('passes keys with a modifier on from an end control', async () => {
    const onSelect = vi.fn();
    render(<ServiceOrder initial="hymn1" onSelect={onSelect} />);
    screen.getByRole('button', {name: '내리기'}).focus();
    const keys = recordWindowKeys();
    await userEvent.keyboard('{Control>}{ArrowDown}{ArrowUp}{Home}{/Control}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(passedKeys(keys)).toEqual([
      'Control',
      'ArrowDown',
      'ArrowUp',
      'Home',
    ]);
  });

  it('keeps Enter and the list keys in 진행 and passes Space and ← → on', async () => {
    const seen: Array<[string, boolean]> = [];
    const listener = (event: KeyboardEvent): void => {
      seen.push([event.key, event.defaultPrevented]);
    };
    window.addEventListener('keydown', listener);
    onTestFinished(() => window.removeEventListener('keydown', listener));
    const onSelect = vi.fn();
    render(
      <ServiceOrder workspace="show" initial="count" onSelect={onSelect} />,
    );
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedTitle()).toBe('hymn1');
    await userEvent.keyboard('{End}{Home}');
    expect(selectedTitle()).toBe('count');
    onSelect.mockClear();
    await userEvent.keyboard(' {ArrowRight}{ArrowLeft}{PageDown}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(seen.slice(-4)).toEqual([
      [' ', false],
      ['ArrowRight', false],
      ['ArrowLeft', false],
      ['PageDown', false],
    ]);
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('count');
  });

  it('passes the list keys on when Ctrl, Alt, Shift, or Meta is held', async () => {
    const prevented: string[] = [];
    const listener = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) prevented.push(event.key);
    };
    window.addEventListener('keydown', listener);
    onTestFinished(() => window.removeEventListener('keydown', listener));
    const onSelect = vi.fn();
    render(
      <ServiceOrder workspace="show" initial="count" onSelect={onSelect} />,
    );
    await userEvent.tab();
    for (const modifier of ['Control', 'Alt', 'Shift', 'Meta']) {
      await userEvent.keyboard(
        `{${modifier}>}{ArrowDown}{ArrowUp}{End}{Home}{Enter}{/${modifier}}`,
      );
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(prevented).toEqual([]);
    await userEvent.keyboard('{ArrowDown}');
    expect(selectedTitle()).toBe('hymn1');
  });

  it('lets Esc and the clear keys pass from an end control', async () => {
    const seen: string[] = [];
    const listener = (event: KeyboardEvent): void => {
      seen.push(event.key);
    };
    window.addEventListener('keydown', listener);
    onTestFinished(() => window.removeEventListener('keydown', listener));
    render(<ServiceOrder />);
    screen.getByRole('button', {name: '내리기'}).focus();
    await userEvent.keyboard('{Escape}{F1}{F7}');
    expect(seen).toEqual(['Escape', 'F1', 'F7']);
  });

  it('draws a two-line item with its second line', () => {
    render(
      <ListBox label="지난 예배" selected={undefined} onSelect={() => {}} inset>
        <ListRow
          value="last"
          icon="cal"
          title="주일 예배"
          sub={['10월 25일 일요일', '항목 12개']}
        />
      </ListBox>,
    );
    expect(screen.getByRole('option', {name: '주일 예배'}).textContent).toBe(
      '주일 예배10월 25일 일요일항목 12개',
    );
  });
});

describe('ListActionRow', () => {
  it('runs on click and reports an on item with aria-pressed', async () => {
    const onPress = vi.fn();
    render(
      <ListActionRow icon="prop" title="로고 화면" pressed onPress={onPress} />,
    );
    const row = screen.getByRole('button', {name: '로고 화면'});
    expect(row.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    const onPress = vi.fn();
    render(<ListActionRow title="요 3:16" disabled onPress={onPress} />);
    await userEvent.click(screen.getByRole('button', {name: '요 3:16'}));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ListSlot and ListDragGhost', () => {
  it('names an empty slot by its type', () => {
    render(<ListSlot icon="song" label="찬양" />);
    expect(screen.getByText('빈 자리')).toBeDefined();
    expect(screen.getByText('찬양')).toBeDefined();
  });

  it('hides the drag ghost from assistive technology', () => {
    const {container} = render(
      <ListDragGhost icon="song" title="주 하나님 지으신 모든 세계" adding />,
    );
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('ListGroup rename', () => {
  it('turns the name into a field that saves on Enter and leaving, and cancels on Esc', async () => {
    const onCommit = vi.fn().mockReturnValue(true);
    const onCancel = vi.fn();
    render(
      <ListGroup label="찬양" rename={{onCommit, onClose: onCancel}}>
        <span>rows</span>
      </ListGroup>,
    );
    const field = screen.getByRole('textbox', {name: '찬양 이름'});
    expect(document.activeElement).toBe(field);
    await userEvent.keyboard('{Control>}a{/Control}말씀{Enter}');
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('말씀');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cancels on Esc without saving when the field loses focus afterwards', async () => {
    const onCommit = vi.fn().mockReturnValue(true);
    const onCancel = vi.fn();
    render(
      <ListGroup label="찬양" rename={{onCommit, onClose: onCancel}}>
        <span>rows</span>
      </ListGroup>,
    );
    await userEvent.keyboard('{Escape}');
    await userEvent.tab();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('ListRow rename', () => {
  function renameRow(
    onCommit = vi.fn().mockReturnValue(true),
    onCancel = vi.fn(),
  ) {
    render(
      <ListBox label="Playlists" selected={undefined} onSelect={vi.fn()}>
        <ListRow
          value="a"
          title="Old name"
          rename={{onCommit, onClose: onCancel}}
        />
      </ListBox>,
    );
    return {
      onCommit,
      onCancel,
      field: screen.getByRole('textbox', {name: 'Old name 이름'}),
    };
  }

  it('passes modified Enter and Escape without finishing the rename', () => {
    const {onCommit, onCancel, field} = renameRow();
    const keys = vi.fn();
    window.addEventListener('keydown', keys);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of ['Enter', 'Escape']) {
        expect(fireEvent.keyDown(field, {key, [modifier]: true})).toBe(true);
      }
    }
    window.removeEventListener('keydown', keys);
    expect(keys).toHaveBeenCalledTimes(8);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(field, {key: 'Enter'});
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('saves the typed name on Enter, once', () => {
    const {onCommit, field} = renameRow();
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, {target: {value: 'New name'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('New name');
  });

  it('keeps the old name on Esc and saves when the field is left', () => {
    const {onCommit, onCancel, field} = renameRow();
    fireEvent.keyDown(field, {key: 'Escape'});
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
    cleanup();
    const left = renameRow();
    fireEvent.change(left.field, {target: {value: 'Left'}});
    fireEvent.blur(left.field);
    expect(left.onCommit).toHaveBeenCalledExactlyOnceWith('Left');
  });
});
