import {useState, type JSX} from 'react';
import {Button} from '../Button';
import {TextField} from '../TextField';
import {Section, SpecGroup, SpecItem} from './Spec';

const specimens = [
  ['heading', '새 예배'],
  ['title', '예배 순서'],
  ['body', '함께 걷는 길, 목록과 메뉴'],
  ['label', '기본 배경, 속성 이름'],
  ['caption', '11월 1일 일요일, 슬라이드 6개'],
] as const;

export function TypographySection(): JSX.Element {
  const [serviceName, setServiceName] = useState('새 예배');
  return (
    <Section title="Typography">
      <SpecGroup title="M3 one-step larger type scale" alignTop>
        {specimens.map(([name, sample]) => (
          <SpecItem key={name} label={`type-${name}`}>
            <span style={{font: `var(--type-${name})`}}>{sample}</span>
          </SpecItem>
        ))}
      </SpecGroup>
      <SpecGroup title="Standard control heights">
        <SpecItem label="md: 30px">
          <Button size="md">만들기</Button>
        </SpecItem>
        <SpecItem label="sm: 26px">
          <Button>가져오기</Button>
        </SpecItem>
        <SpecItem label="Text field: 30px">
          <TextField
            aria-label="예배 이름"
            value={serviceName}
            onChange={setServiceName}
          />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
