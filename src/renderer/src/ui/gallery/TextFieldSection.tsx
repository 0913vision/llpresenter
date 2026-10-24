import type {JSX} from 'react';
import {NumberField} from '../NumberField';
import {TextArea} from '../TextArea';
import {TextField, type TextFieldProps} from '../TextField';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';

const DUPLICATE_TITLE = '라이브러리에 같은 제목의 곡이 있습니다';

function Field({
  initial = '',
  ...props
}: Omit<TextFieldProps, 'value' | 'onChange'> & {
  readonly initial?: string;
}): JSX.Element {
  return (
    <Stateful initial={initial}>
      {(value, setValue) => (
        <TextField block {...props} value={value} onChange={setValue} />
      )}
    </Stateful>
  );
}

export function TextFieldSection(): JSX.Element {
  return (
    <Section title="TextField">
      <SpecGroup title="Sizes" surface="panel">
        <SpecItem label="md 30, new service name" width={220}>
          <Field aria-label="이름" initial="주일 예배" />
        </SpecItem>
        <SpecItem label="md 30, leading icon, 퀵 실행" width={252}>
          <Field
            aria-label="성경 구절"
            icon="book"
            placeholder="요 3:16, 창 1:1-5"
          />
        </SpecItem>
        <SpecItem label="sm 26, 퀵 실행 in a narrow window" width={192}>
          <Field
            aria-label="성경 구절"
            size="sm"
            icon="book"
            placeholder="요 3:16"
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Search fields">
        <SpecItem
          label="Toolbar search, ring-field because it sits on bg-app"
          width={420}
        >
          <Field
            aria-label="검색"
            icon="search"
            clearable
            ring
            placeholder="곡, 가사, 초성"
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup surface="panel">
        <SpecItem label="Empty" width={252}>
          <Field
            aria-label="라이브러리 검색"
            icon="search"
            clearable
            placeholder="제목, 가사, 초성"
          />
        </SpecItem>
        <SpecItem label="With a value, clear-text button" width={252}>
          <Field
            aria-label="라이브러리 검색"
            icon="search"
            clearable
            initial="주 하나님"
          />
        </SpecItem>
        <SpecItem
          label="sm, hover on the clear-text button"
          pin="hover"
          pinIndex={1}
          width={220}
        >
          <Field
            aria-label="동작 찾기"
            size="sm"
            icon="search"
            clearable
            initial="오디오"
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="States" surface="panel">
        <SpecItem label="Default" width={200}>
          <Field aria-label="성경 구절" icon="book" initial="요 3:16-18" />
        </SpecItem>
        <SpecItem label="Focus" pin="focus" width={200}>
          <Field aria-label="성경 구절" icon="book" initial="요 3:16-18" />
        </SpecItem>
        <SpecItem label="Error, reason in a title tooltip" width={200}>
          <Field
            aria-label="제목"
            initial="만복의 근원 하나님"
            invalid
            invalidReason={DUPLICATE_TITLE}
          />
        </SpecItem>
        <SpecItem label="Disabled" width={200}>
          <Field
            aria-label="성경 구절"
            icon="book"
            placeholder="요 3:16, 창 1:1-5"
            disabled
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Number fields and range fields" surface="panel">
        <SpecItem label="Number 96, unit outside the field">
          <Stateful initial={10}>
            {(value, setValue) => (
              <NumberField
                aria-label="복구 사본"
                min={1}
                max={50}
                unit="개"
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Number, unit attached to the value">
          <Stateful initial={6}>
            {(value, setValue) => (
              <NumberField
                aria-label="여백"
                min={0}
                max={20}
                suffix="%"
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Prefix inside the field, media range" width={300}>
          <Field
            aria-label="구간 시작"
            affix="시작"
            numeric
            initial="00:00.0"
          />
          <Field aria-label="구간 끝" affix="끝" numeric initial="00:30.0" />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Title field, inside a panel header" surface="panel">
        <SpecItem label="280, title 13/600, sm 26">
          <Field
            aria-label="곡 제목"
            variant="title"
            block={false}
            initial="주 하나님 지으신 모든 세계"
          />
        </SpecItem>
        <SpecItem label="Same title exists">
          <Field
            aria-label="곡 제목"
            variant="title"
            block={false}
            initial="만복의 근원 하나님"
            invalid
            invalidReason={DUPLICATE_TITLE}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Multiline, notes in item settings" surface="panel">
        <SpecItem label="Default" width={400}>
          <Stateful initial={'마지막 후렴은 천천히\n인도자 신호 보고 끝내기'}>
            {(value, setValue) => (
              <TextArea aria-label="메모" value={value} onChange={setValue} />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="Empty, focus" pin="focus" width={400}>
          <Stateful initial="">
            {(value, setValue) => (
              <TextArea
                aria-label="메모"
                placeholder="메모"
                value={value}
                onChange={setValue}
              />
            )}
          </Stateful>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
