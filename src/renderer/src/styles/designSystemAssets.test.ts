import {describe, expect, it} from 'vitest';

const PROJECT = '../../../../design/system/project/';
const projectFiles = new Set(
  Object.keys(
    import.meta.glob('../../../../design/system/project/**/*', {
      query: '?url',
      import: 'default',
      eager: true,
    }),
  ),
);

describe('design system assets', () => {
  // NOTE(0913vision): Vitest replaces CSS with an empty string, so this test
  // can't read the @font-face URL from tokens.css; it names the same path.
  it('ships the font that tokens.css loads, with its OFL license', () => {
    expect(projectFiles.has(`${PROJECT}fonts/PretendardVariable.woff2`)).toBe(
      true,
    );
    expect(projectFiles.has(`${PROJECT}fonts/LICENSE.txt`)).toBe(true);
  });
});
