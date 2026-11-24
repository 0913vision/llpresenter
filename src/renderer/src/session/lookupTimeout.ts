/** How long a fresh read from main may take before it counts as failed. */
export const LOOKUP_TIMEOUT_MS = 2000;

/**
 * Waits for a read from main for at most {@link LOOKUP_TIMEOUT_MS}, and always
 * releases its timer. A read that takes longer rejects.
 */
export async function withinLookupTimeout<T>(
  read: () => Promise<T>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Lookup timed out')),
          LOOKUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
