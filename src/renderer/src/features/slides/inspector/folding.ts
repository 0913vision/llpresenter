import {create} from 'zustand';

type Fold = 'texts' | 'place';

/** Which folds are open, for every slide alike, until the app closes. */
const useFolds = create<Readonly<Record<Fold, boolean>>>(() => ({
  texts: false,
  place: false,
}));

export function useFold(fold: Fold): {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
} {
  const open = useFolds(view => view[fold]);
  return {open, onOpenChange: next => useFolds.setState({[fold]: next})};
}
