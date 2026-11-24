/** Lets the shell ask the 테마 editor before it leaves the 테마 workspace. */
export class ThemeLeaveGuard {
  private ask: ((proceed: () => void) => void) | null = null;

  /** Registers the editor's question; the returned function removes it. */
  attach(ask: (proceed: () => void) => void): () => void {
    this.ask = ask;
    return () => {
      if (this.ask === ask) this.ask = null;
    };
  }

  /** Runs `proceed` now, or after the editor's answer when edits are unsaved. */
  leave(proceed: () => void): void {
    if (this.ask === null) proceed();
    else this.ask(proceed);
  }
}
