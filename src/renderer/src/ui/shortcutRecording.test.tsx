import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {
  SHORTCUT_RECORDING_SELECTOR,
  shortcutRecordingProps,
} from './shortcutRecording';

describe('shortcutRecordingProps', () => {
  it('marks a recording field for the window shortcuts to skip', () => {
    render(
      <>
        <input aria-label="단축키" {...shortcutRecordingProps} />
        <input aria-label="이름" />
      </>,
    );
    expect(
      screen
        .getByRole('textbox', {name: '단축키'})
        .closest(SHORTCUT_RECORDING_SELECTOR),
    ).not.toBe(null);
    expect(
      screen
        .getByRole('textbox', {name: '이름'})
        .closest(SHORTCUT_RECORDING_SELECTOR),
    ).toBe(null);
  });
});
