import {randomUUID} from 'node:crypto';
import {analysisUrl} from '@shared/media';

/**
 * How many files the analysis page may borrow at once. It reads one file at a
 * time, so a second loan means one wasn't given back.
 */
export const MAX_LENT_ANALYSIS_FILES = 1;

/** A file lent to the analysis page. */
export interface LentFile {
  readonly url: string;
  /** Takes the file back, so its URL stops working. */
  readonly release: () => void;
}

/**
 * The files main lends the analysis page, each under a random token for as
 * long as one analysis runs, so the page reads them on the media scheme
 * without a media id.
 */
export class AnalysisFiles {
  private readonly files = new Map<string, string>();

  /** Lends a file; null while another one is lent. */
  lend(file: string): LentFile | null {
    if (this.files.size >= MAX_LENT_ANALYSIS_FILES) return null;
    const token = randomUUID();
    this.files.set(token, file);
    return {
      url: analysisUrl(token),
      release: () => {
        this.files.delete(token);
      },
    };
  }

  fileOf(token: string): string | null {
    return this.files.get(token) ?? null;
  }
}
