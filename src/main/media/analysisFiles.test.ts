import {describe, expect, it} from 'vitest';
import {analysisTokenFromUrl} from '@contracts/ipc/mediaUrls';
import {AnalysisFiles} from './analysisFiles';

const A = '/media/a.mp4';
const B = '/media/b.mp4';

describe('files lent for analysis', () => {
  it('lends one file at a time under a token that stops working when released', () => {
    const files = new AnalysisFiles();
    const lent = files.lend(A);
    const token = analysisTokenFromUrl(lent?.url ?? '') ?? '';
    expect(files.fileOf(token)).toBe(A);
    expect(files.lend(B)).toBeNull();
    lent?.release();
    expect(files.fileOf(token)).toBeNull();
    const next = files.lend(B);
    expect(next?.url).not.toBe(lent?.url);
    expect(files.fileOf('unknown')).toBeNull();
  });
});
