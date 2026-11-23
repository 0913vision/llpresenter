/**
 * Keeps the uses of PowerPoint apart: one file is read at a time, and one set
 * of pictures is exported at a time. PowerPoint may still be closing when the
 * pictures are ready, and a file can be read meanwhile.
 */
export class PowerPointTurns {
  private reading = false;
  private exporting: 'no' | 'drawing' | 'closing' = 'no';
  private closed: Promise<void> = Promise.resolve();
  private readonly afterExport = new Set<() => void>();

  get isReading(): boolean {
    return this.reading;
  }

  get isExporting(): boolean {
    return this.exporting !== 'no';
  }

  /** Takes the turn to read a file, and tells if it was free. */
  startReading(): boolean {
    if (this.reading || this.exporting === 'drawing') return false;
    this.reading = true;
    return true;
  }

  endReading(): void {
    this.reading = false;
  }

  /** Settles when PowerPoint has closed after the last export. */
  lastExport(): Promise<void> {
    return this.closed;
  }

  /** Takes the turn to export pictures, and tells if it was free. */
  startExport(): boolean {
    if (this.reading || this.exporting !== 'no') return false;
    this.exporting = 'drawing';
    return true;
  }

  /** The pictures are ready; the turn ends when PowerPoint has closed. */
  endExport(closed: Promise<void> = Promise.resolve()): void {
    this.exporting = 'closing';
    this.closed = closed.finally(() => {
      this.exporting = 'no';
      for (const task of this.afterExport) task();
      this.afterExport.clear();
    });
  }

  /** Does something that an export must not see, once none runs. */
  whenNoExport(task: () => void): void {
    if (this.isExporting) this.afterExport.add(task);
    else task();
  }
}
