import {DOMParser} from '@xmldom/xmldom';
import {expect, it} from 'vitest';
import {paletteOf, resolveColor} from '@main/import/pptx/powerpointColors';

function element(xml: string): Element {
  const root = new DOMParser().parseFromString(
    `<root xmlns:a="urn:a" xmlns:p="urn:p">${xml}</root>`,
    'application/xml',
  ).documentElement;
  const first = Array.from(root.childNodes).find(
    (child): child is Element => child.nodeType === 1,
  );
  if (first === undefined) throw new Error('No element');
  return first;
}

const theme = element(
  '<a:theme><a:clrScheme><a:dk1><a:sysClr lastClr="000000"/></a:dk1><a:lt1><a:srgbClr val="ffffff"/></a:lt1><a:accent1><a:srgbClr val="4472c4"/></a:accent1></a:clrScheme></a:theme>',
);
const palette = paletteOf([], theme);
const hex = (xml: string, colors = palette) => {
  const {r, g, b} = resolveColor(element(xml), colors);
  return [r, g, b]
    .map(channel =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
};

it.each([
  ['<a:srgbClr val="12AB34"/>', '12ab34'],
  ['<a:srgbClr val="wrong"/>', '000000'],
  ['<a:sysClr lastClr="FFFFFF"/>', 'ffffff'],
  ['<a:prstClr val="yellow"/>', 'ffff00'],
  ['<a:prstClr val="unknown"/>', '000000'],
  ['<a:scrgbClr r="100000" g="0" b="0"/>', 'ff0000'],
  ['<a:schemeClr val="accent1"/>', '4472c4'],
  ['<a:schemeClr val="missing"/>', '000000'],
  ['<a:other/>', '000000'],
])('reads %s', (xml, wanted) => {
  expect(hex(xml)).toBe(wanted);
});

it.each([
  ['<a:srgbClr val="808080"><a:shade val="50000"/></a:srgbClr>', '404040'],
  ['<a:srgbClr val="000000"><a:tint val="0"/></a:srgbClr>', 'ffffff'],
  ['<a:srgbClr val="000000"><a:lumOff val="50000"/></a:srgbClr>', '808080'],
  ['<a:srgbClr val="ff0000"><a:lumMod val="50000"/></a:srgbClr>', '800000'],
  ['<a:srgbClr val="ffffff"><a:redMod val="0"/></a:srgbClr>', '00ffff'],
  ['<a:srgbClr val="ffffff"><a:greenMod val="0"/></a:srgbClr>', 'ff00ff'],
  ['<a:srgbClr val="ffffff"><a:blueMod val="0"/></a:srgbClr>', 'ffff00'],
])('changes a color as %s says', (xml, wanted) => {
  expect(hex(xml)).toBe(wanted);
});

it('keeps how much of a color shows', () => {
  expect(
    resolveColor(
      element(
        '<a:srgbClr val="ffffff"><a:alpha val="50000"/><a:alphaMod val="50000"/><a:alphaOff val="10000"/></a:srgbClr>',
      ),
      palette,
    ).alpha,
  ).toBeCloseTo(0.35, 5);
});

it('follows the colors that the master and a slide of it map', () => {
  const master = element(
    '<p:sldMaster><p:clrMap bg1="dk1" tx1="lt1"/></p:sldMaster>',
  );
  const keeps = element(
    '<p:sld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
  );
  const own = element(
    '<p:sld><p:clrMapOvr><a:overrideClrMapping tx1="accent1"/></p:clrMapOvr></p:sld>',
  );
  const text = '<a:schemeClr val="tx1"/>';
  expect(hex(text)).toBe('000000');
  expect(hex(text, paletteOf([master], theme))).toBe('ffffff');
  expect(hex(text, paletteOf([master, keeps], theme))).toBe('ffffff');
  expect(hex(text, paletteOf([master, own], theme))).toBe('4472c4');
});
