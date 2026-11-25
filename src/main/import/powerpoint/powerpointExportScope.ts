import type {Logger} from '../../base/log';
import type {TemporaryPictures} from '../slidePictures/temporaryPictures';
import type {PowerPointTurns} from './powerpointTurns';

/** What a scope uses of the temporary pictures: their folders. */
type ScopeFolders = Pick<TemporaryPictures, 'openFolder' | 'closeFolder'>;

/**
 * One export's turn and its folder of pictures, which it holds together and
 * frees together. Disposing it, which `await using` does on every path, ends
 * the turn and removes the folder once PowerPoint has closed.
 */
export class PowerPointExportScope implements AsyncDisposable {
  private opened: string | null = null;
  private closed: Promise<void> | null = null;
  private released = false;

  private constructor(
    private readonly turns: PowerPointTurns,
    private readonly pictures: ScopeFolders,
    private readonly log: Logger,
  ) {}

  /**
   * Takes the export turn once PowerPoint has closed after the last export.
   *
   * @returns The scope, or null when another use of PowerPoint has the turn.
   */
  static async take({
    turns,
    pictures,
    log,
  }: {
    readonly turns: PowerPointTurns;
    readonly pictures: ScopeFolders;
    readonly log: Logger;
  }): Promise<PowerPointExportScope | null> {
    await turns.lastExport();
    return turns.startExport()
      ? new PowerPointExportScope(turns, pictures, log)
      : null;
  }

  /** The export's folder, made the first time it is asked for. */
  async folder(): Promise<string> {
    this.opened ??= await this.pictures.openFolder();
    return this.opened;
  }

  /** PowerPoint closes after the pictures are there; the turn waits for it. */
  closeAfter(closed: Promise<void>): void {
    this.closed = closed;
  }

  /**
   * Ends the turn once PowerPoint has closed and the folder is gone. The caller
   * waits for that unless PowerPoint is still closing after its pictures came.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.released) return;
    this.released = true;
    const stillClosing = this.closed !== null;
    const done = this.whenClosed();
    this.turns.endExport(done);
    if (!stillClosing) await done;
  }

  private async whenClosed(): Promise<void> {
    try {
      await (this.closed ?? Promise.resolve());
    } catch (error) {
      this.log.warn('could not close PowerPoint', error);
    }
    if (this.opened === null) return;
    try {
      await this.pictures.closeFolder(this.opened);
    } catch (error) {
      this.log.warn('could not remove PowerPoint pictures', error);
    }
  }
}
