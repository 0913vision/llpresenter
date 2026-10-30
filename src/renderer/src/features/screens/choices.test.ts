import {describe, expect, it} from 'vitest';
import {lookInUse, stageLayoutsInUse} from './choices';
import {
  LAYOUT_ID,
  LOOK_ID,
  SERMON_LOOK_ID,
  WIDE_LAYOUT_ID,
  looksDocument,
  screensDocument,
} from './testing/documents';

function looks() {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Expected looks');
  return document.value;
}

function screens() {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document.value;
}

describe('lookInUse', () => {
  it('uses the selected Look, or the saved current Look without one', () => {
    expect(lookInUse(looks(), undefined)).toBe(LOOK_ID);
    expect(lookInUse(looks(), null)).toBe(LOOK_ID);
    expect(lookInUse(looks(), looks().looks[1]?.id)).toBe(SERMON_LOOK_ID);
  });
});

describe('stageLayoutsInUse', () => {
  it('gives the 무대 layout of the Look in use', () => {
    expect([...stageLayoutsInUse(looks(), screens(), undefined)]).toEqual([
      LAYOUT_ID,
    ]);
    expect([
      ...stageLayoutsInUse(looks(), screens(), looks().looks[1]?.id),
    ]).toEqual([WIDE_LAYOUT_ID]);
  });

  it('gives nothing when the Look in use is missing', () => {
    const document = looksDocument(1, WIDE_LAYOUT_ID);
    if (document.name !== 'looks') throw new Error('Expected looks');
    expect(stageLayoutsInUse(document.value, screens(), undefined).size).toBe(
      0,
    );
  });
});
