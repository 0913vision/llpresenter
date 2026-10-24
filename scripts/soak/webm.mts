/** One encoded VP8 frame and when it shows, from the start of the clip. */
export interface EncodedFrame {
  readonly data: Uint8Array;
  readonly timestampMs: number;
  readonly key: boolean;
}

/** An encoded clip: its size, its frames in order, and how long each shows. */
export interface EncodedClip {
  readonly width: number;
  readonly height: number;
  readonly frameMs: number;
  readonly frames: readonly EncodedFrame[];
}

const ID = {
  ebml: [0x1a, 0x45, 0xdf, 0xa3],
  ebmlVersion: [0x42, 0x86],
  ebmlReadVersion: [0x42, 0xf7],
  ebmlMaxIdLength: [0x42, 0xf2],
  ebmlMaxSizeLength: [0x42, 0xf3],
  docType: [0x42, 0x82],
  docTypeVersion: [0x42, 0x87],
  docTypeReadVersion: [0x42, 0x85],
  segment: [0x18, 0x53, 0x80, 0x67],
  info: [0x15, 0x49, 0xa9, 0x66],
  timecodeScale: [0x2a, 0xd7, 0xb1],
  duration: [0x44, 0x89],
  muxingApp: [0x4d, 0x80],
  writingApp: [0x57, 0x41],
  tracks: [0x16, 0x54, 0xae, 0x6b],
  trackEntry: [0xae],
  trackNumber: [0xd7],
  trackUid: [0x73, 0xc5],
  trackType: [0x83],
  codecId: [0x86],
  video: [0xe0],
  pixelWidth: [0xb0],
  pixelHeight: [0xba],
  cluster: [0x1f, 0x43, 0xb6, 0x75],
  timecode: [0xe7],
  simpleBlock: [0xa3],
} as const;

const NANOSECONDS_PER_MS = 1_000_000;
const VIDEO_TRACK = 1;
const VIDEO_TRACK_TYPE = 1;
const TRACK_NUMBER_BYTE = 0x80 | VIDEO_TRACK;
const KEY_FRAME_FLAG = 0x80;
const SIZE_BYTES = 8;
const MAX_RELATIVE_MS = 0x7fff;
const APP_NAME = 'llp-soak';

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function sizeField(size: number): Uint8Array {
  const field = new Uint8Array(SIZE_BYTES);
  field[0] = 0x01;
  let rest = size;
  for (let index = SIZE_BYTES - 1; index > 0; index -= 1) {
    field[index] = rest % 0x100;
    rest = Math.floor(rest / 0x100);
  }
  return field;
}

function element(id: readonly number[], ...body: Uint8Array[]): Uint8Array {
  const data = concat(body);
  return concat([Uint8Array.from(id), sizeField(data.length), data]);
}

function unsigned(id: readonly number[], value: number): Uint8Array {
  const bytes: number[] = [];
  let rest = value;
  do {
    bytes.unshift(rest % 0x100);
    rest = Math.floor(rest / 0x100);
  } while (rest > 0);
  return element(id, Uint8Array.from(bytes));
}

function float(id: readonly number[], value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value);
  return element(id, bytes);
}

function text(id: readonly number[], value: string): Uint8Array {
  return element(id, new TextEncoder().encode(value));
}

function header(): Uint8Array {
  return element(
    ID.ebml,
    unsigned(ID.ebmlVersion, 1),
    unsigned(ID.ebmlReadVersion, 1),
    unsigned(ID.ebmlMaxIdLength, 4),
    unsigned(ID.ebmlMaxSizeLength, 8),
    text(ID.docType, 'webm'),
    unsigned(ID.docTypeVersion, 4),
    unsigned(ID.docTypeReadVersion, 2),
  );
}

function info(durationMs: number): Uint8Array {
  return element(
    ID.info,
    unsigned(ID.timecodeScale, NANOSECONDS_PER_MS),
    text(ID.muxingApp, APP_NAME),
    text(ID.writingApp, APP_NAME),
    float(ID.duration, durationMs),
  );
}

function tracks({width, height}: EncodedClip): Uint8Array {
  return element(
    ID.tracks,
    element(
      ID.trackEntry,
      unsigned(ID.trackNumber, VIDEO_TRACK),
      unsigned(ID.trackUid, VIDEO_TRACK),
      unsigned(ID.trackType, VIDEO_TRACK_TYPE),
      text(ID.codecId, 'V_VP8'),
      element(
        ID.video,
        unsigned(ID.pixelWidth, width),
        unsigned(ID.pixelHeight, height),
      ),
    ),
  );
}

function simpleBlock(frame: EncodedFrame, clusterMs: number): Uint8Array {
  const relative = new Uint8Array(2);
  new DataView(relative.buffer).setInt16(
    0,
    Math.round(frame.timestampMs - clusterMs),
  );
  const flags = frame.key ? KEY_FRAME_FLAG : 0;
  return element(
    ID.simpleBlock,
    Uint8Array.from([TRACK_NUMBER_BYTE]),
    relative,
    Uint8Array.from([flags]),
    frame.data,
  );
}

function groupIntoClusters(frames: readonly EncodedFrame[]): EncodedFrame[][] {
  const clusters: EncodedFrame[][] = [];
  for (const frame of frames) {
    const current = clusters.at(-1);
    const start = current?.[0]?.timestampMs ?? 0;
    const tooFar = frame.timestampMs - start > MAX_RELATIVE_MS;
    if (current === undefined || frame.key || tooFar) clusters.push([frame]);
    else current.push(frame);
  }
  return clusters;
}

function cluster(frames: readonly EncodedFrame[]): Uint8Array {
  const clusterMs = Math.round(frames[0]?.timestampMs ?? 0);
  return element(
    ID.cluster,
    unsigned(ID.timecode, clusterMs),
    ...frames.map(frame => simpleBlock(frame, clusterMs)),
  );
}

/**
 * Wraps encoded VP8 frames in a WebM file with a known duration and a cluster
 * per key frame. MediaRecorder leaves the duration out, and the output's loop
 * and seek math needs it.
 */
export function muxWebm(clip: EncodedClip): Uint8Array {
  const last = clip.frames.at(-1);
  if (last === undefined) throw new Error('a clip needs at least one frame');
  if (clip.frames[0]?.key !== true) {
    throw new Error('a clip must start with a key frame');
  }
  const durationMs = last.timestampMs + clip.frameMs;
  return concat([
    header(),
    element(
      ID.segment,
      info(durationMs),
      tracks(clip),
      ...groupIntoClusters(clip.frames).map(cluster),
    ),
  ]);
}
