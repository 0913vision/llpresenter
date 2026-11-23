import koffi from 'koffi';

/** Milliseconds from 1601, where Windows counts its file times, to 1970. */
const FILETIME_TO_UNIX_MS = 11_644_473_600_000;

let read: (() => number) | null | undefined;

/** The Windows clock, read from the system at each call; null elsewhere or when it cannot load. */
function windowsClock(): (() => number) | null {
  if (process.platform !== 'win32') return null;
  try {
    const kernel32 = koffi.load('kernel32.dll');
    // NOTE(0913vision): An unnamed struct, so no other koffi user's type
    // name can clash with it.
    const fileTime = koffi.struct({
      dwLowDateTime: 'uint32',
      dwHighDateTime: 'uint32',
    });
    const now = kernel32.func(
      '__stdcall',
      'GetSystemTimePreciseAsFileTime',
      'void',
      [koffi.out(koffi.pointer(fileTime))],
    );
    return () => {
      const time = {dwLowDateTime: 0, dwHighDateTime: 0};
      now(time);
      const ticks = time.dwHighDateTime * 2 ** 32 + time.dwLowDateTime;
      return ticks / 10_000 - FILETIME_TO_UNIX_MS;
    };
  } catch {
    return null;
  }
}

/**
 * The computer's clock now, in epoch milliseconds. On Windows, Date.now()
 * counts on from a reading of the clock it takes again only once a minute, so
 * after the clock is set by hand it is up to a minute off; this reads Windows
 * itself each time.
 */
export function systemNow(): number {
  read ??= windowsClock();
  return read === null ? Date.now() : read();
}
