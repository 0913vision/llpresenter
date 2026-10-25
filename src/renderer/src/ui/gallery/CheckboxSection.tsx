import type {JSX} from 'react';
import {
  CheckList,
  CheckRow,
  Checkbox,
  type CheckRowProps,
  type CheckState,
} from '../Checkbox';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';

const LIST_WIDTH = 440;
const DIALOG_WIDTH = 412;

function Box({
  label,
  name,
  initial,
  disabled = false,
  pinned = false,
}: {
  readonly label: string;
  readonly name: string;
  readonly initial: CheckState;
  readonly disabled?: boolean;
  readonly pinned?: boolean;
}): JSX.Element {
  return (
    <SpecItem label={label} pin={pinned ? 'focus' : undefined}>
      <Stateful initial={initial}>
        {(checked, setChecked) => (
          <Checkbox
            aria-label={name}
            checked={checked}
            disabled={disabled}
            onChange={setChecked}
          />
        )}
      </Stateful>
    </SpecItem>
  );
}

function Row({
  initial,
  ...props
}: Omit<CheckRowProps, 'checked' | 'onChange'> & {
  readonly initial: CheckState;
}): JSX.Element {
  return (
    <Stateful initial={initial}>
      {(checked, setChecked) => (
        <CheckRow {...props} checked={checked} onChange={setChecked} />
      )}
    </Stateful>
  );
}

export function CheckboxSection(): JSX.Element {
  return (
    <Section title="Checkbox">
      <SpecGroup title="Box 16×16" surface="panel">
        <Box label="Off" name="꺼짐" initial={false} />
        <Box label="On" name="켜짐" initial />
        <Box label="Mixed" name="일부" initial="mixed" />
        <Box label="Focus" name="포커스" initial={false} pinned />
        <Box label="On, focus" name="켜짐 포커스" initial pinned />
        <Box label="Disabled, off" name="쓸 수 없음" initial={false} disabled />
        <Box label="Disabled, on" name="쓸 수 없음 켜짐" initial disabled />
        <Box
          label="Disabled, mixed"
          name="쓸 수 없음 일부"
          initial="mixed"
          disabled
        />
      </SpecGroup>
      <SpecGroup title="List rows, 다른 예배에서 가져오기" surface="inset">
        <SpecItem
          label="Group rows, off, hover, focus, disabled"
          width={LIST_WIDTH}
        >
          <CheckList label="가져올 항목">
            <Row variant="group" label="예배 전" initial="mixed" />
            <Row
              variant="list"
              icon="film"
              label="예배 전 카운트다운"
              initial={false}
            />
            <Row variant="list" icon="notice" label="주일 광고" initial />
            <Row variant="group" label="찬양" initial={false} />
            <Row
              variant="list"
              icon="song"
              label="만복의 근원 하나님"
              meta="주일용"
              initial={false}
            />
            <Row
              variant="list"
              icon="song"
              label="주 하나님 지으신 모든 세계"
              meta="기본"
              initial
            />
            <Row
              variant="list"
              icon="song"
              label="내 주를 가까이 하게 함은"
              meta="기본"
              disabled
              initial={false}
            />
          </CheckList>
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Rows with a value, 출력 상태 복구" surface="dialog">
        <SpecItem
          label="Inside a dialog, row 30, no hover"
          width={DIALOG_WIDTH}
        >
          <div>
            <Row
              icon="mplay"
              label="화면 출력"
              value="본 화면, 무대 화면, 방송 자막"
              initial
            />
            <Row
              icon="slides"
              label="마지막 장"
              value="만복의 근원 하나님  2 / 9"
              initial
            />
            <Row
              icon="layers"
              label="표시 중이던 항목"
              value="메시지 1, 소품 1, 무대 메시지 1"
              initial={false}
            />
          </div>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
