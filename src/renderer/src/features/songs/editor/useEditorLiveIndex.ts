import {useLive} from '@renderer/session/live';

/** Matches this editor's source, independently of the open item in Show. */
export function useEditorLiveIndex(
  sourceId: string | undefined,
  slides: ReadonlyArray<{readonly id: string}>,
): number | undefined {
  return useLive(view => {
    const slide = view.state?.layers.slide;
    if (sourceId === undefined || slide?.itemId !== sourceId) return undefined;
    if (slide.sourceSlideId === undefined) return slide.position;
    const index = slides.findIndex(source => source.id === slide.sourceSlideId);
    return index < 0 ? undefined : index;
  });
}
