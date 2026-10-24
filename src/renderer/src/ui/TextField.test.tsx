import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {TextArea} from './TextArea';
import {TextField, type TextFieldProps} from './TextField';

type FieldOverrides = Omit<TextFieldProps, 'value' | 'onChange'>;

function Search({
  initial = '',
  onChange = () => {},
  ...props
}: FieldOverrides & {
  readonly initial?: string;
  readonly onChange?: (value: string) => void;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <TextField
      aria-label="라이브러리 검색"
      icon="search"
      clearable
      {...props}
      value={value}
      onChange={next => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function searchBox(): HTMLInputElement {
  const input = screen.getByRole('textbox', {name: '라이브러리 검색'});
  if (!(input instanceof HTMLInputElement)) throw new Error('No input');
  return input;
}

describe('TextField', () => {
  it('reports every keystroke', async () => {
    const onChange = vi.fn();
    render(<Search onChange={onChange} />);
    await userEvent.type(searchBox(), '주님');
    expect(onChange).toHaveBeenLastCalledWith('주님');
    expect(searchBox().value).toBe('주님');
  });

  it('focuses the input on a press anywhere in the field', async () => {
    const {container} = render(<Search />);
    const icon = container.querySelector('[aria-hidden="true"]');
    if (icon === null) throw new Error('No icon');
    await userEvent.click(icon);
    expect(document.activeElement).toBe(searchBox());
  });

  it('shows the clear-text button only while there is a value', async () => {
    render(<Search />);
    expect(screen.queryByRole('button', {name: '검색어 지우기'})).toBeNull();
    await userEvent.type(searchBox(), '은혜');
    const clear = screen.getByRole('button', {name: '검색어 지우기'});
    expect(clear.tabIndex).toBe(-1);
    await userEvent.click(clear);
    expect(searchBox().value).toBe('');
    expect(document.activeElement).toBe(searchBox());
  });

  it('clears the value with Esc, then releases focus', async () => {
    const onOuterKey = vi.fn();
    render(
      <div
        onKeyDown={event => {
          onOuterKey(event.key);
        }}
      >
        <Search initial="은혜" />
      </div>,
    );
    await userEvent.click(searchBox());
    await userEvent.keyboard('{Escape}');
    expect(searchBox().value).toBe('');
    expect(document.activeElement).toBe(searchBox());
    expect(onOuterKey).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).not.toBe(searchBox());
  });

  it('leaves Esc alone when it is not a search field', async () => {
    const onChange = vi.fn();
    render(
      <TextField aria-label="이름" value="주일 예배" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks an invalid value and gives the reason as its description', () => {
    render(
      <TextField
        variant="title"
        aria-label="곡 제목"
        value="만복의 근원 하나님"
        onChange={() => {}}
        invalid
        invalidReason="라이브러리에 같은 제목의 곡이 있습니다"
      />,
    );
    const input = screen.getByRole('textbox', {name: '곡 제목'});
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).not.toBeNull();
    expect(
      screen.getByRole('textbox', {
        description: '라이브러리에 같은 제목의 곡이 있습니다',
      }),
    ).toBe(input);
    expect(input.parentElement?.getAttribute('title')).toBe(
      '라이브러리에 같은 제목의 곡이 있습니다',
    );
  });

  it('keeps the caller description and drops the reason once valid', () => {
    const {rerender} = render(
      <TextField
        aria-label="제목"
        aria-describedby="hint"
        value=""
        onChange={() => {}}
        invalid
        invalidReason="이유"
      />,
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toMatch(/^hint \S+$/);
    rerender(
      <TextField
        aria-label="제목"
        aria-describedby="hint"
        value=""
        onChange={() => {}}
        invalidReason="이유"
      />,
    );
    expect(input.getAttribute('aria-describedby')).toBe('hint');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('has no clear-text button while disabled', () => {
    render(<Search initial="은혜" disabled title="이유" />);
    expect(searchBox().disabled).toBe(true);
    expect(screen.queryByRole('button', {name: '검색어 지우기'})).toBeNull();
  });

  it('shows a prefix inside the field', () => {
    render(
      <TextField
        aria-label="구간 시작"
        affix="시작"
        value="00:00.0"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('시작')).toBeDefined();
  });
});

describe('TextArea', () => {
  it('reports typed text, line breaks included', async () => {
    const onChange = vi.fn();
    function Notes(): JSX.Element {
      const [value, setValue] = useState('');
      return (
        <TextArea
          aria-label="메모"
          value={value}
          onChange={next => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }
    render(<Notes />);
    await userEvent.type(
      screen.getByRole('textbox', {name: '메모'}),
      '첫 줄{Enter}둘',
    );
    expect(onChange).toHaveBeenLastCalledWith('첫 줄\n둘');
  });

  it('marks an invalid value with its reason', () => {
    render(
      <TextArea
        aria-label="메모"
        value=""
        onChange={() => {}}
        invalid
        invalidReason="너무 깁니다"
      />,
    );
    expect(
      screen.getByRole('textbox', {name: '메모', description: '너무 깁니다'}),
    ).toBeDefined();
  });
});
