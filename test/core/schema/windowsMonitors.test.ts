import {describe, expect, it} from 'vitest';
import {parseWindowsMonitors} from '@core/schema/windowsMonitors';
function monitors(value: unknown) {
  const result = parseWindowsMonitors(value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

const bounds = {x: 1920, y: 0, width: 1920, height: 1080};

describe('native identity validation', () => {
  const devicePath = String.raw`\\?\DISPLAY#DEL1234#instance#{e6f07b5f-ee97-4a90-b076-33f57bf4eaa7}`;
  const path = {devicePath, bounds: bounds};
  const row = {
    instanceName: String.raw`DISPLAY\DEL1234\instance_0`,
    manufacturer: 'DEL',
    product: '1234',
    serial: 'PANEL123',
  };
  it('joins by instance rather than WMI order or friendly name', () => {
    const result = monitors({
      paths: [path],
      wmi: [{...row, instanceName: 'other', serial: 'WRONG'}, row],
    });
    expect(result[0]?.identity?.edid?.serial).toBe('PANEL123');
  });
  it.each(['', '000000', 'UNKNOWN', 'N/A', 'x'.repeat(65)])(
    'does not trust serial %s',
    serial => {
      expect(
        monitors({paths: [path], wmi: [{...row, serial}]})[0]?.identity?.edid,
      ).toBeUndefined();
    },
  );
  it('rejects duplicate WMI joins and inconsistent hardware IDs', () => {
    expect(
      monitors({paths: [path], wmi: [row, row]})[0]?.identity?.edid,
    ).toBeUndefined();
    expect(
      monitors({paths: [path], wmi: [{...row, product: 'FFFF'}]})[0]?.identity
        ?.edid,
    ).toBeUndefined();
  });
  it('rejects malformed or oversized external replies', () => {
    expect(() => monitors({paths: [path], wmi: Array(65).fill(row)})).toThrow();
    expect(() =>
      monitors({
        paths: [{...path, bounds: {...bounds, width: -1}}],
        wmi: [],
      }),
    ).toThrow();
  });
});
