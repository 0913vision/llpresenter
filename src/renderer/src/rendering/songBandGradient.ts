import {BROADCAST_LOOK_GEOMETRY as geometry} from '@core/themes/broadcastLook';

/** The song band's NDI fade and opaque capture-window fallback. */
export function songBandGradient(capture: boolean): string {
  const pct = (x: number): number =>
    Math.round((x / geometry.screenWidth) * 100_000) / 1000;
  const start = pct(geometry.songBandFadeStart);
  const end = pct(geometry.songBandFadeEnd);
  const black = capture
    ? geometry.shadowColor
    : `rgba(0, 0, 0, ${geometry.songBandOpacity / 100})`;
  return capture
    ? `linear-gradient(90deg, transparent ${start}%, ${black} ${start}%, ${black} ${end}%, transparent ${end}%)`
    : `linear-gradient(90deg, transparent ${start}%, ${black} ${pct(geometry.songBandSolidStart)}%, ${black} ${pct(geometry.songBandSolidEnd)}%, transparent ${end}%)`;
}
