import {describe, expect, it} from 'vitest';
import {muxWebm, type EncodedClip, type EncodedFrame} from './webm.mts';

interface Element {
  readonly id: number;
  readonly data: Uint8Array;
}

const ID = {
  ebml: 0x1a45dfa3,
  docType: 0x4282,
  segment: 0x18538067,
  info: 0x1549a966,
  timecodeScale: 0x2ad7b1,
  duration: 0x4489,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  codecId: 0x86,
  video: 0xe0,
  pixelWidth: 0xb0,
  pixelHeight: 0xba,
  cluster: 0x1f43b675,
  timecode: 0xe7,
  simpleBlock: 0xa3,
};

function vintLength(first: number): number {
  for (let length = 1; length <= 8; length += 1) {
    if (first & (0x100 >> length)) return length;
  }
  throw new Error('not a variable-length integer');
}

function readElements(bytes: Uint8Array): Element[] {
  const elements: Element[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const idLength = vintLength(bytes[offset] ?? 0);
    let id = 0;
    for (let i = 0; i < idLength; i += 1) {
      id = id * 256 + (bytes[offset + i] ?? 0);
    }
    offset += idLength;
    const sizeLength = vintLength(bytes[offset] ?? 0);
    let size = (bytes[offset] ?? 0) & (0xff >> sizeLength);
    for (let i = 1; i < sizeLength; i += 1) {
      size = size * 256 + (bytes[offset + i] ?? 0);
    }
    offset += sizeLength;
    elements.push({id, data: bytes.subarray(offset, offset + size)});
    offset += size;
  }
  return elements;
}

function child(elements: readonly Element[], id: number): Element {
  const found = elements.find(element => element.id === id);
  if (found === undefined) throw new Error(`no element ${id.toString(16)}`);
  return found;
}

function children(elements: readonly Element[], id: number): Element[] {
  return readElements(child(elements, id).data);
}

function unsigned(data: Uint8Array): number {
  return data.reduce((value, byte) => value * 256 + byte, 0);
}

function text(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

function frames(count: number, keyEvery: number): EncodedFrame[] {
  return Array.from({length: count}, (_, index) => ({
    data: Uint8Array.from([index, 0xaa, 0xbb]),
    timestampMs: (index * 1000) / 30,
    key: index % keyEvery === 0,
  }));
}

function clip(frameList: readonly EncodedFrame[]): EncodedClip {
  return {width: 1920, height: 1080, frameMs: 1000 / 30, frames: frameList};
}

interface Block {
  readonly timeMs: number;
  readonly key: boolean;
  readonly first: number;
}

function blocks(file: readonly Element[]): Block[] {
  const segment = children(file, ID.segment);
  return segment
    .filter(element => element.id === ID.cluster)
    .flatMap(cluster => {
      const parts = readElements(cluster.data);
      const start = unsigned(child(parts, ID.timecode).data);
      return parts
        .filter(part => part.id === ID.simpleBlock)
        .map(({data}) => ({
          timeMs:
            start + new DataView(data.buffer, data.byteOffset).getInt16(1),
          key: ((data[3] ?? 0) & 0x80) !== 0,
          first: data[4] ?? -1,
        }));
    });
}

describe('muxWebm', () => {
  const file = readElements(muxWebm(clip(frames(90, 30))));

  it('writes a WebM header', () => {
    expect(text(child(children(file, ID.ebml), ID.docType).data)).toBe('webm');
  });

  it('gives the clip its duration in milliseconds', () => {
    const info = children(children(file, ID.segment), ID.info);
    expect(unsigned(child(info, ID.timecodeScale).data)).toBe(1_000_000);
    const duration = child(info, ID.duration).data;
    expect(
      new DataView(duration.buffer, duration.byteOffset).getFloat64(0),
    ).toBe(3000);
  });

  it('describes one VP8 video track of the clip size', () => {
    const tracks = children(children(file, ID.segment), ID.tracks);
    const entry = readElements(child(tracks, ID.trackEntry).data);
    expect(text(child(entry, ID.codecId).data)).toBe('V_VP8');
    const video = readElements(child(entry, ID.video).data);
    expect(unsigned(child(video, ID.pixelWidth).data)).toBe(1920);
    expect(unsigned(child(video, ID.pixelHeight).data)).toBe(1080);
  });

  it('keeps every frame in order at its time, with a cluster per key frame', () => {
    const segment = children(file, ID.segment);
    expect(segment.filter(e => e.id === ID.cluster)).toHaveLength(3);
    const written = blocks(file);
    expect(written.map(block => block.first)).toEqual(
      Array.from({length: 90}, (_, index) => index),
    );
    expect(written.map(block => block.timeMs)).toEqual(
      frames(90, 30).map(frame => Math.round(frame.timestampMs)),
    );
    expect(written.filter(block => block.key).map(b => b.first)).toEqual([
      0, 30, 60,
    ]);
  });

  it('starts a new cluster before a relative time would overflow', () => {
    const sparse = [
      {data: Uint8Array.from([1]), timestampMs: 0, key: true},
      {data: Uint8Array.from([2]), timestampMs: 40_000, key: false},
    ];
    const written = blocks(readElements(muxWebm(clip(sparse))));
    expect(written.map(block => block.timeMs)).toEqual([0, 40_000]);
  });

  it('refuses a clip without frames or without a leading key frame', () => {
    expect(() => muxWebm(clip([]))).toThrow('at least one frame');
    const noKey = [{data: Uint8Array.from([1]), timestampMs: 0, key: false}];
    expect(() => muxWebm(clip(noKey))).toThrow('start with a key frame');
  });
});
