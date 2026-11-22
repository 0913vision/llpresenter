const writes = new WeakMap<object, Promise<boolean>>();

/** System text mirrors the model clipboard; fast paste waits for its latest copy. */
export function writeSlideText(owner: object, text: string): void {
  const written = (writes.get(owner) ?? Promise.resolve(true)).then(
    async () => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.error('Could not copy slide text', error);
        return false;
      }
    },
  );
  writes.set(owner, written);
}

export async function readSlideText(owner: object): Promise<string> {
  for (;;) {
    const written = writes.get(owner);
    const copied = await written;
    if (written !== writes.get(owner)) continue;
    if (copied === false) throw new Error('System slide copy failed');
    const text = await navigator.clipboard.readText();
    if (written === writes.get(owner)) return text;
  }
}
