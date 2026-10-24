import {writeFileAtomically, type WriteProblem} from './atomicWrite';
import {FileWriter, type WriteFile, type WriteResult} from './fileWriter';
import type {RecoveryCopies, RecoveryTarget} from './recoveryCopies';

/** The text to write over a file, and where its recovery copies go. */
export interface SaveRequest {
  readonly target: RecoveryTarget;
  readonly text: string;
}

export interface SaverOptions {
  readonly copies: Pick<RecoveryCopies, 'keepPrevious'>;
  readonly reportCopyProblem: (problem: WriteProblem) => void;
  /** Writes the text. An atomic write by default. */
  readonly writeText?: WriteFile<string>;
}

/**
 * Saves a file the safe way: it keeps a recovery copy of the previous version,
 * then writes the new text atomically. The copy and the write of a file run as
 * one step, one save at a time and in the order asked for, so a copy that
 * finishes late can never let an older text win. A recovery copy that fails is
 * reported, and the save still goes ahead, because losing the operator's edit
 * is worse than missing one copy.
 */
export class Saver {
  private readonly writer = new FileWriter<SaveRequest>((_file, request) =>
    this.copyThenWrite(request),
  );
  private readonly writeText: WriteFile<string>;

  constructor(private readonly options: SaverOptions) {
    this.writeText = options.writeText ?? writeFileAtomically;
  }

  save(request: SaveRequest): Promise<WriteResult> {
    return this.writer.write(request.target.file, request);
  }

  /** Resolves once every save asked for so far has finished. */
  idle(): Promise<void> {
    return this.writer.idle();
  }

  private async copyThenWrite({
    target,
    text,
  }: SaveRequest): Promise<WriteResult> {
    const copied = await this.options.copies.keepPrevious(target);
    if (!copied.ok) {
      this.options.reportCopyProblem(copied.error);
    }
    return this.writeText(target.file, text);
  }
}
