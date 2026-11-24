import {useState} from 'react';

export function useOptimisticCreation<T extends {readonly id: string}>(
  persisted: readonly T[],
) {
  const [pending, setPending] = useState<readonly T[]>([]);
  const visible = pending.filter(
    item => !persisted.some(saved => saved.id === item.id),
  );
  if (visible.length !== pending.length) setPending(visible);
  const create = (
    item: T,
    save: Promise<boolean>,
    refused: () => void,
  ): void => {
    setPending(current => [...current, item]);
    const rollback = (): void => {
      setPending(current => current.filter(value => value.id !== item.id));
      refused();
    };
    save.then(
      saved => {
        if (!saved) rollback();
      },
      (cause: unknown) => {
        rollback();
        window.llp?.log.write({
          level: 'error',
          message: 'Could not finish optimistic creation',
          detail: String(cause),
        });
      },
    );
  };
  return {items: [...persisted, ...visible], pending: visible, create};
}
