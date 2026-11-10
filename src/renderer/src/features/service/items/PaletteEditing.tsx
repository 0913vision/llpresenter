import {createContext, use, useRef, type ReactNode} from 'react';
import {useShow} from '@renderer/session/show';
import {useServiceOrderEditing} from '@renderer/session/useServiceOrderEditing';
import type {Notice} from '@renderer/ui/notices';

type Editing = ReturnType<typeof useServiceOrderEditing>;
export interface PaletteEditing {
  readonly enqueueInsert: (operation: Parameters<Editing['apply']>[0]) => void;
}
const PaletteEditingContext = createContext<PaletteEditing | null>(null);

/** Serializes palette insertions from both the palette and the order table. */
export function PaletteEditingProvider({
  onProblem,
  children,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly children: ReactNode;
}) {
  const serviceId = useShow(view => view.serviceId);
  const editing = useServiceOrderEditing(serviceId, onProblem);
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const enqueueInsert: PaletteEditing['enqueueInsert'] = operation => {
    const service = serviceId;
    tail.current = tail.current.then(() => {
      if (service === null || useShow.getState().serviceId !== service) {
        return false;
      }
      return editing.apply(operation);
    });
  };
  return (
    <PaletteEditingContext value={{enqueueInsert}}>
      {children}
    </PaletteEditingContext>
  );
}
export function usePaletteEditing(): PaletteEditing | null {
  return use(PaletteEditingContext);
}
