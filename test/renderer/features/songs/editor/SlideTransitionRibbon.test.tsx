import {screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';

it('leaves transition controls to the inspector', async () => {
  await editorSetup();
  expect(
    screen.queryByRole('group', {
      name: '슬라이드 전환',
    }),
  ).toBeNull();
});
