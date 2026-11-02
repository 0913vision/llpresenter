import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {applyService} from '@renderer/session/show';
import {ReadOnlyMark} from '@renderer/features/presentation/ReadOnlyMark';
import {sampleService} from '@fixtures/renderer/session/sampleService';

afterEach(() => {
  cleanup();
  applyService(null);
});

describe('ReadOnlyMark', () => {
  it('shows a warning with a tooltip for a read-only service', () => {
    applyService({...sampleService, readOnly: true});
    render(<ReadOnlyMark />);
    expect(
      screen.getByRole('img', {
        name: '새 버전의 파일이라 바꿀 수 없습니다',
      }).title,
    ).toBe('새 버전의 파일이라 바꿀 수 없습니다');
  });

  it('shows nothing for an editable service or none', () => {
    applyService(sampleService);
    const {container} = render(<ReadOnlyMark />);
    expect(container.firstChild).toBeNull();
    applyService(null);
    expect(container.firstChild).toBeNull();
  });
});
