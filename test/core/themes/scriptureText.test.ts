import {describe, expect, it} from 'vitest';
import {scriptureText} from '@core/themes/scriptureText';

describe('scriptureText', () => {
  it('joins automatic Bible rows without losing typed line breaks', () => {
    expect(scriptureText(['첫 자동 줄', '다음 자동 줄\n직접 입력한 줄'])).toBe(
      '첫 자동 줄 다음 자동 줄\n직접 입력한 줄',
    );
    expect(scriptureText(['첫 줄\n\n마지막 줄'])).toBe('첫 줄\n\n마지막 줄');
  });
});
