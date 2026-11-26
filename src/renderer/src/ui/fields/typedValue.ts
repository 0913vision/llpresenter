import {useLayoutEffect, useRef, useState, type RefObject} from 'react';

/** What a text box needs to show its owner's value without losing typing. */
export interface TypedValue {
  /** The value to start the box with (`defaultValue`). */
  readonly initial: string;
  /**
   * Called by the box's change handler after it told the owner: notes the
   * typed text and, once the owner's update is in, puts the owner's value
   * back if the owner refused or changed it.
   */
  readonly typed: (text: string) => void;
}

/** Writes `text` into the box, and notes it as the text both sides agree on. */
function show(
  box: HTMLInputElement | HTMLTextAreaElement | null,
  known: {current: string},
  text: string,
): void {
  known.current = text;
  if (box !== null && box.value !== text) box.value = text;
}

/**
 * Shows `value` in a text box, but writes it into the box only when the owner
 * changed it: set it from outside, or refused or changed what was typed. A
 * render that still carries the value from before the latest key leaves the
 * box alone, so the key's text stays. A controlled box writes that older
 * value back over it when such a render lands between the browser's insert
 * and the change it reports, which lost characters typed fast on a slow or
 * busy PC (PROBE42: "창세기" became "창세").
 *
 * @returns The box's starting value and the function its change handler
 *   calls.
 */
export function useTypedValue(
  box: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  value: string,
): TypedValue {
  const [initial] = useState(value);
  /** The owner's latest value. */
  const owned = useRef(value);
  /** The latest text the box and its owner agree on, or the box reported. */
  const known = useRef(value);
  useLayoutEffect(() => {
    owned.current = value;
    if (value !== known.current) show(box.current, known, value);
  });
  return {
    initial,
    typed: text => {
      known.current = text;
      // NOTE(0913vision): React applies the owner's update to a change in a
      // microtask queued when the owner set its state, so this one runs
      // after it: an owner that kept its value refused the text.
      queueMicrotask(() => {
        if (known.current === text && owned.current !== text) {
          show(box.current, known, owned.current);
        }
      });
    },
  };
}
