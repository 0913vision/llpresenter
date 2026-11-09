import {screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';

it('leaves transition controls to the inspector', async () => {
  await editorSetup();
  expect(
    screen.queryByRole('group', {
      name: '\uC2AC\uB77C\uC774\uB4DC \uC804\uD658',
    }),
  ).toBeNull();
});
