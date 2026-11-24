import {create} from 'zustand';

/** The tabs of the slide inspector: 내용, 디자인 and 전환. */
export const INSPECTOR_TABS = [
  {value: 'texts', label: '내용'},
  {value: 'look', label: '디자인'},
  {value: 'transition', label: '전환'},
] as const;

/** The value of one tab of the slide inspector. */
export type InspectorTab = (typeof INSPECTOR_TABS)[number]['value'];

/** The tab stays the same from slide to slide and from item to item. */
const useTab = create<{readonly tab: InspectorTab}>(() => ({tab: 'texts'}));

/** The open tab of the slide inspector. */
export function useInspectorTab(): InspectorTab {
  return useTab(view => view.tab);
}

/** Opens a tab of the slide inspector. */
export function showInspectorTab(tab: InspectorTab): void {
  useTab.setState({tab});
}
