/**
 * What a rename in place needs from its owner: the rules for a name, and what
 * happens on commit and close.
 */
export interface RenameContract {
  /** The longest name; the field stops there and a longer one is refused. */
  readonly maxLength?: number | undefined;
  /** A rule of its own, such as a name that is taken, before the shared one. */
  readonly validate?: ((value: string) => string | undefined) | undefined;
  readonly onCommit: (name: string) => boolean | Promise<boolean>;
  readonly onClose: () => void;
  /** Commits a name equal to the one shown, such as a copy's suggestion. */
  readonly commitsUnchanged?: boolean | undefined;
}
