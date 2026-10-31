import {screen} from '@testing-library/react';
import {useState, type JSX} from 'react';
import {IconButton} from '../IconButton';
import {ListBox} from '../ListBox';
import {ListGroup, ListRow} from '../ListRow';
import type {Workspace} from '../workspace';

/** The existing selectable service-order fixture shared by list and row tests. */
export function ServiceOrder({
  initial,
  onSelect = () => undefined,
  onDismiss = () => undefined,
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

/** Reads the selected option value from the shared service-order fixture. */
export function selectedTitle(): string | undefined {
  return (
    screen
      .getAllByRole('option')
      .find(option => option.getAttribute('aria-selected') === 'true')
      ?.getAttribute('data-value') ?? undefined
  );
}
