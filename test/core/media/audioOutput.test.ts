import {describe, expect, it} from 'vitest';
import {resolveAudioSink} from '@core/media/audioOutput';

const DEVICES = [
  {id: 'hall-1', label: 'Mixer (USB)'},
  {id: 'phones-1', label: 'Headphones'},
];

describe('resolveAudioSink', () => {
  it('plays to the Windows default with no choice or an empty id', () => {
    expect(resolveAudioSink(undefined, DEVICES)).toEqual({
      sinkId: '',
      missing: false,
    });
    expect(resolveAudioSink({id: '', label: 'Windows 기본 장치'}, [])).toEqual({
      sinkId: '',
      missing: false,
    });
  });

  it('finds a connected device by id', () => {
    expect(
      resolveAudioSink({id: 'hall-1', label: 'Old name'}, DEVICES),
    ).toEqual({sinkId: 'hall-1', missing: false});
  });

  it('finds a device that came back under another id by its label', () => {
    expect(
      resolveAudioSink({id: 'hall-0', label: 'Headphones'}, DEVICES),
    ).toEqual({sinkId: 'phones-1', missing: false});
  });

  it('falls back to the default and says the device is missing', () => {
    expect(
      resolveAudioSink({id: 'gone', label: 'Unplugged mixer'}, DEVICES),
    ).toEqual({sinkId: '', missing: true});
    expect(resolveAudioSink({id: 'gone', label: ''}, DEVICES)).toEqual({
      sinkId: '',
      missing: true,
    });
  });
});
