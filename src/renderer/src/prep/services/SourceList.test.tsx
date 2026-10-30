import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import type {ServiceEntry} from '@shared/schema/contentDocuments';
import {createServiceId} from '@shared/schema/ids';
import {SourceList} from './SourceList';
import {ids, serviceEntries, templateEntries} from './testing';

const newer: ServiceEntry = {
  id: createServiceId('40000000-0000-4000-8000-000000000003'),
  name: '추수감사 예배',
  date: '2026-11-01T11:00',
  access: 'editable',
};

function names(): readonly string[] {
  return screen.getAllByRole('option').map(option => option.textContent);
}

describe('SourceList', () => {
  it('lists 빈 예배, the 템플릿, and the services newest first with dates and counts', () => {
    render(
      <SourceList
        templates={templateEntries}
        services={[...serviceEntries, newer]}
        selected={{kind: 'template', id: ids.template}}
        onSelect={() => undefined}
        withEmpty
      />,
    );
    expect(names()).toEqual([
      '빈 예배',
      '주일 예배항목 3개',
      '추수감사 예배11월 1일 일요일',
      '지난 주일 예배10월 25일 일요일항목 1개',
    ]);
    expect(
      screen
        .getByRole('option', {name: /^주일 예배/})
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('group', {name: '템플릿'})).toBeDefined();
    expect(screen.getByRole('group', {name: '지난 예배'})).toBeDefined();
  });

  it('reports the source of the row the operator picks', async () => {
    const onSelect = vi.fn();
    render(
      <SourceList
        templates={templateEntries}
        services={serviceEntries}
        selected={null}
        onSelect={onSelect}
        withEmpty
      />,
    );
    await userEvent.click(screen.getByRole('option', {name: /지난 주일 예배/}));
    await userEvent.click(screen.getByRole('option', {name: '빈 예배'}));
    expect(onSelect.mock.calls).toEqual([
      [{kind: 'service', id: ids.past}],
      [{kind: 'empty'}],
    ]);
  });

  it('leaves out 빈 예배 and groups with no rows', () => {
    render(
      <SourceList
        templates={[]}
        services={serviceEntries}
        selected={null}
        onSelect={() => undefined}
        withEmpty={false}
      />,
    );
    expect(names()).toEqual(['지난 주일 예배10월 25일 일요일항목 1개']);
    expect(screen.queryByRole('group', {name: '템플릿'})).toBeNull();
  });

  it('offers 다시 시도 when a list could not be read', async () => {
    const onRetry = vi.fn();
    const {rerender} = render(
      <SourceList
        templates={[]}
        services={serviceEntries}
        selected={null}
        onSelect={() => undefined}
        withEmpty
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('목록을 다 읽지 못했습니다')).toBeDefined();
    await userEvent.click(screen.getByRole('button', {name: '다시 시도'}));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(
      <SourceList
        templates={[]}
        services={serviceEntries}
        selected={null}
        onSelect={() => undefined}
        withEmpty
      />,
    );
    expect(screen.queryByRole('button', {name: '다시 시도'})).toBeNull();
  });
});
