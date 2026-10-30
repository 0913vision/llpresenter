import type {LooksFile} from '../schema/looks';

/** Layout assignments in all persisted Look cards, including inactive Looks. */
export function referencedStageLayouts(looks: LooksFile): ReadonlySet<string> {
  const referenced = new Set<string>();
  for (const look of looks.looks) {
    for (const card of Object.values(look.screens)) {
      if (card.stageLayout !== undefined) referenced.add(card.stageLayout);
    }
  }
  return referenced;
}
