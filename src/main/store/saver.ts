import type {WriteProblem} from './atomicWrite';
import type {FileWriter, WriteResult} from './fileWriter';
import type {RecoveryCopies, RecoveryTarget} from './recoveryCopies';

/** The text to write over a file, and where its recovery copies go. */
export interface SaveRequest {
  readonly target: RecoveryTarget;
  readonly text: string;
}

/**
 * Saves a file the safe way: it keeps a recovery copy of the previous version,
 * then writes the new text atomically, one write per file at a time. A
 * recovery copy that fails is reported, and the save still goes ahead, because
 * losing the operator's edit is worse than missing one copy.
 */
export class Saver {
  constructor(
    private readonly writer: FileWriter,
    private readonly copies: RecoveryCopies,
    private readonly reportCopyProblem: (problem: WriteProblem) => void,
  ) {}

  async save({target, text}: SaveRequest): Promise<WriteResult> {
    const copied = await this.copies.keepPrevious(target);
    if (!copied.ok) {
      this.reportCopyProblem(copied.error);
    }
    return this.writer.write(target.file, text);
  }
}
