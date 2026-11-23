import {expect, it} from 'vitest';
import {fillTemplates} from '@core/theme';

const values =
  (known: Record<string, string>) =>
  (token: string): string | undefined =>
    known[token];
const hymn = '다음 곡: {제목} {(찬송가)} {(이름표)}';

it('puts a value in brackets only when it was put in with them', () => {
  const all = values({
    제목: '성부 성자 성령',
    찬송가: '새찬송가 7장',
    이름표: '전주',
  });
  expect(fillTemplates([hymn], all)).toBe(
    '다음 곡: 성부 성자 성령 (새찬송가 7장) (전주)',
  );
  expect(fillTemplates(['({제목})'], values({제목: '찬양'}))).toBe('(찬양)');
});

it('leaves a missing value out with one space beside it', () => {
  expect(
    fillTemplates(
      [hymn],
      values({제목: '성부 성자 성령', 찬송가: '새찬송가 7장'}),
    ),
  ).toBe('다음 곡: 성부 성자 성령 (새찬송가 7장)');
  expect(fillTemplates(['{(새 이름표)} {가사}'], values({가사: '주님'}))).toBe(
    '주님',
  );
  expect(
    fillTemplates(
      ['다음 곡: {곡 제목} {(이름표)}\n{가사}'],
      values({'곡 제목': '임재'}),
    ),
  ).toBe('다음 곡: 임재');
  expect(fillTemplates(['설교 {(제목)}'], values({}))).toBeNull();
  expect(
    fillTemplates(['{번호}. {제목}'], values({번호: '1', 제목: '광고'})),
  ).toBe('1. 광고');
});

it('takes the next template when none of the values is there', () => {
  const templates = ['{(새 이름표)} {가사}', '{(이름표)}', '(없음)'];
  expect(fillTemplates(templates, values({이름표: '후렴'}))).toBe('(후렴)');
  expect(fillTemplates(templates, values({}))).toBe('(없음)');
  expect(fillTemplates(['다음 순서: {항목 이름}'], values({}))).toBeNull();
});
