import {describe, expect, it} from 'vitest';
import {join} from 'node:path';
import {openReal, runtimePath} from '../../../src/main/ndi/ndi-library.cjs';

describe('NDI runtime discovery', () => {
  it('uses the runtime directory and handles it being absent', () => {
    expect(runtimePath({})).toBeNull();
    expect(runtimePath({NDI_RUNTIME_DIR_V6: 'runtime'})).toBe(
      join('runtime', 'Processing.NDI.Lib.x64.dll'),
    );
    expect(() => openReal({})).toThrow('NDI_RUNTIME_MISSING');
    expect(() =>
      openReal({NDI_RUNTIME_DIR_V6: join('missing', 'runtime')}),
    ).toThrow('NDI_RUNTIME_MISSING');
  });
});
