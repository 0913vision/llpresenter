import {useEffect, useRef, useState} from 'react';

export function useClipboardAvailability(
  read: (() => Promise<boolean>) | undefined,
) {
  const [status, setStatus] = useState<'checking' | 'empty' | 'ready'>(
    'checking',
  );
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const check = (): void => {
    const query = read;
    setStatus('checking');
    if (query === undefined || pending.current) return;
    pending.current = true;
    const run = async (): Promise<void> => {
      try {
        const available = await query();
        if (alive.current) setStatus(available ? 'ready' : 'empty');
      } finally {
        pending.current = false;
      }
    };
    run().catch((error: unknown) => {
      console.error('Clipboard availability check failed', error);
      if (alive.current) setStatus('empty');
    });
  };
  return {status, check};
}
