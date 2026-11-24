import {describe, expect, it} from 'vitest';
import {sundayTemplate} from '@core/slides';
import {parseTemplate, serializeTemplate} from '@core/schema/services/service';

const SECTIONS = [
  '예배 전',
  '묵상기도',
  '사도신경',
  '회개와간구의기도',
  '찬양',
  '합심기도',
  '말씀',
  '봉헌',
  '봉헌기도',
  '광고',
  '축도',
];

describe('sundayTemplate', () => {
  it('is a 템플릿 file the app writes and reads back unchanged', () => {
    const template = sundayTemplate();
    const text = serializeTemplate(template, 'sunday.lltemplate');
    if (!text.ok) throw new Error(JSON.stringify(text.error));

    const read = parseTemplate(text.value, 'sunday.lltemplate');

    expect(read.ok && read.value.data).toEqual(template);
    expect(template.name).toBe('주일 2부 예배');
  });

  it('has the church order of sections, with 말씀 left to fill', () => {
    const {order} = sundayTemplate();
    const headers = order.flatMap(item =>
      item.kind === 'header' ? [item.name] : [],
    );

    expect(headers).toEqual(SECTIONS);
    const sermon = order.findIndex(
      item => item.kind === 'header' && item.name === '말씀',
    );
    expect(order[sermon + 1]?.kind).toBe('header');
  });

  it('gives every item its own id, new each time', () => {
    const first = sundayTemplate();
    const ids = first.order.map(item => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(sundayTemplate().id).not.toBe(first.id);
  });
});
