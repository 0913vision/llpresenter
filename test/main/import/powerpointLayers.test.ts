import {describe, expect, it} from 'vitest';
import {powerpointArchive} from '@fixtures/main/import/powerpointArchive';
import {PowerPointZip} from '@main/import/powerpointZip';
import {PowerPointLayerReader} from '@main/import/powerpointLayers';

const ns = 'xmlns:p="urn:p" xmlns:a="urn:a" xmlns:r="urn:r"';
const solid = (color: string) =>
  `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
const bg = (color: string) => `<p:bg><p:bgPr>${solid(color)}</p:bgPr></p:bg>`;
const xfrm = '<a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm>';
const shape = (id: string, fill = solid('ff0000'), extra = '') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}"/>${extra}</p:nvSpPr><p:spPr>${xfrm}<a:prstGeom prst="rect"/>${fill}</p:spPr></p:sp>`;
const root = (kind: string, content = '', background = '') =>
  `<p:${kind} ${ns}><p:cSld>${background}<p:spTree>${content}</p:spTree></p:cSld>${kind === 'sldMaster' ? '<p:clrMap bg1="accent2"/>' : ''}</p:${kind}>`;
const rel = (target: string, kind: string, id = 'r1') =>
  `<Relationship Id="${id}" Target="${target}" Type="urn:rel/${kind}"/>`;
const relations = (content: string) =>
  `<Relationships>${content}</Relationships>`;
function fixture(
  slide: string,
  layout = root('sldLayout'),
  master = root('sldMaster'),
) {
  return {
    'ppt/slides/s.xml': slide,
    'ppt/slides/_rels/s.xml.rels': relations(
      rel('../slideLayouts/l.xml', 'slideLayout') +
        rel('../media/photo.png', 'image', 'photo'),
    ),
    'ppt/slideLayouts/l.xml': layout,
    'ppt/slideLayouts/_rels/l.xml.rels': relations(
      rel('../slideMasters/m.xml', 'slideMaster'),
    ),
    'ppt/slideMasters/m.xml': master,
    'ppt/slideMasters/_rels/m.xml.rels': relations(
      rel('../theme/t.xml', 'theme'),
    ),
    'ppt/theme/t.xml': `<a:theme ${ns}><a:themeElements><a:clrScheme><a:accent2><a:srgbClr val="204060"/></a:accent2></a:clrScheme><a:fmtScheme><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
  };
}
function read(parts: Record<string, string>) {
  return new PowerPointLayerReader(
    new PowerPointZip(powerpointArchive(parts)),
  ).read('ppt/slides/s.xml', {width: 100, height: 100});
}

describe('PowerPoint background layers', () => {
  it('restores the master mapping when the slide explicitly rejects a layout override', () => {
    const fill = '<a:solidFill><a:schemeClr val="bg1"/></a:solidFill>';
    const slide = root('sld', shape('scheme', fill));
    const layout = root('sldLayout').replace(
      '</p:sldLayout>',
      '<p:clrMapOvr><a:overrideClrMapping bg1="accent3"/></p:clrMapOvr></p:sldLayout>',
    );
    const parts = fixture(slide, layout);
    parts['ppt/theme/t.xml'] = parts['ppt/theme/t.xml'].replace(
      '</a:clrScheme>',
      '<a:accent3><a:srgbClr val="ff0000"/></a:accent3></a:clrScheme>',
    );
    expect(read(parts).layers[0]).toMatchObject({
      fill: {color: {r: 1, g: 0, b: 0}},
    });
    parts['ppt/slides/s.xml'] = slide.replace(
      '</p:sld>',
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
    );
    expect(read(parts).layers[0]).toMatchObject({
      fill: {color: {r: 32 / 255, g: 64 / 255, b: 96 / 255}},
    });
  });
  it('uses slide, layout, then master background and preserves shape order', () => {
    const parts = fixture(
      root('sld', shape('s'), bg('ffffff')),
      root('sldLayout', shape('l'), bg('00ff00')),
      root('sldMaster', shape('m'), bg('000000')),
    );
    const result = read(parts);
    expect(result.layers.map(layer => layer.id)).toEqual([
      'background',
      'ppt/slideMasters/m.xml:m',
      'ppt/slideLayouts/l.xml:l',
      'slide:s',
    ]);
    expect(result.layers[0]).toMatchObject({fill: {color: {r: 1, g: 1, b: 1}}});
    expect(
      read({...parts, 'ppt/slides/s.xml': root('sld')}).layers[0],
    ).toMatchObject({fill: {color: {r: 0, g: 1, b: 0}}});
    expect(
      read({
        ...parts,
        'ppt/slides/s.xml': root('sld'),
        'ppt/slideLayouts/l.xml': root('sldLayout'),
      }).layers[0],
    ).toMatchObject({fill: {color: {r: 0, g: 0, b: 0}}});
  });

  it.each(['slide', 'layout'])(
    'honors showMasterSp on the %s without hiding the master background',
    owner => {
      const parts = fixture(
        root('sld').replace(
          '<p:sld ',
          owner === 'slide' ? '<p:sld showMasterSp="0" ' : '<p:sld ',
        ),
        root('sldLayout', shape('l')).replace(
          '<p:sldLayout ',
          owner === 'layout'
            ? '<p:sldLayout showMasterSp="0" '
            : '<p:sldLayout ',
        ),
        root('sldMaster', shape('m'), bg('ffffff')),
      );
      expect(read(parts).layers.map(layer => layer.id)).toEqual([
        'background',
        'ppt/slideLayouts/l.xml:l',
      ]);
    },
  );

  it('resolves theme colors, clrMap, color transforms and background references', () => {
    const background =
      '<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"><a:shade val="50000"/><a:tint val="50000"/><a:alpha val="25000"/></a:schemeClr></p:bgRef></p:bg>';
    const result = read(fixture(root('sld', '', background)));
    expect(result.layers[0]).toMatchObject({
      fill: {
        kind: 'solid',
        color: {alpha: 0.25},
      },
    });
    const layer = result.layers[0];
    if (layer?.kind !== 'shape' || layer.fill?.kind !== 'solid') {
      throw new Error('Expected a solid background');
    }
    expect(layer.fill.color.r).toBeCloseTo((32 / 255) * 0.5 * 0.5 + 0.5, 10);
    const lum =
      '<a:solidFill><a:srgbClr val="808080"><a:lumMod val="50000"/><a:lumOff val="20000"/></a:srgbClr></a:solidFill>';
    expect(read(fixture(root('sld', shape('l', lum)))).layers[0]).toMatchObject(
      {fill: {color: {r: (128 / 255) * 0.5 + 0.2}}},
    );
  });

  it('preserves gradient stop positions, alpha, angle and radial focus', () => {
    const fill =
      '<a:gradFill><a:gsLst><a:gs pos="100000"><a:srgbClr val="ffffff"><a:alpha val="0"/></a:srgbClr></a:gs><a:gs pos="0"><a:schemeClr val="bg1"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>';
    expect(
      read(fixture(root('sld', shape('g', fill)))).layers[0],
    ).toMatchObject({
      fill: {
        kind: 'gradient',
        angle: 90,
        scaled: false,
        radial: false,
        stops: [{position: 0}, {position: 1, color: {alpha: 0}}],
      },
    });
    const radial = fill.replace(
      '<a:lin ang="5400000" scaled="0"/>',
      '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>',
    );
    expect(
      read(fixture(root('sld', shape('g', radial)))).layers[0],
    ).toMatchObject({fill: {radial: true, focus: {left: 0.5, top: 0.5}}});
  });

  it('keeps picture crop, negative extension, stretch, effects, flips and rotation', () => {
    const picture = `<p:pic><p:nvPicPr><p:cNvPr id="p"/></p:nvPicPr><p:blipFill><a:blip r:embed="photo"><a:alphaModFix amt="50000"/><a:lum bright="10000" contrast="-20000"/><a:grayscl/></a:blip><a:srcRect l="10000" t="-20000"/><a:stretch><a:fillRect r="25000"/></a:stretch></p:blipFill><p:spPr><a:xfrm flipH="1" flipV="1" rot="5400000"><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr></p:pic>`;
    const layer = read(fixture(root('sld', picture))).layers[0];
    expect(layer).toMatchObject({
      kind: 'picture',
      crop: {left: 0.1, top: -0.2},
      stretch: {right: 0.25},
      alpha: 0.5,
      brightness: 0.1,
      contrast: -0.2,
      grayscale: true,
    });
    expect(layer?.matrix.a).toBeCloseTo(0);
    expect(layer?.matrix.b).toBeCloseTo(-324);
    expect(layer?.matrix.c).toBeCloseTo(768);
    expect(layer?.matrix.e).toBeCloseTo(96);
  });

  it('transforms grouped geometry and skips text, placeholders and unsupported geometry', () => {
    const group = `<p:grpSp><p:grpSpPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="40" cy="60"/><a:chOff x="0" y="0"/><a:chExt cx="100" cy="100"/></a:xfrm></p:grpSpPr>${shape('group')}</p:grpSp>`;
    const text = shape('text').replace(
      '</p:sp>',
      '<p:txBody><a:p><a:r><a:t>Text</a:t></a:r></a:p></p:txBody></p:sp>',
    );
    const result = read(
      fixture(
        root(
          'sld',
          group +
            text +
            shape('ph', solid('ff0000'), '<p:nvPr><p:ph/></p:nvPr>') +
            shape('triangle').replace('prst="rect"', 'prst="triangle"'),
        ),
      ),
    );
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]?.matrix).toEqual({
      a: 768,
      b: 0,
      c: 0,
      d: 648,
      e: 192,
      f: 216,
    });
    expect(result.skipped).toBe(1);
  });

  it('caps layers and changes the key for non-text content only', () => {
    const base = fixture(root('sld', shape('s')));
    const key = read(base).key;
    expect(
      read({
        ...base,
        'ppt/slides/s.xml': root(
          'sld',
          `${shape('s')}<p:sp><p:txBody><a:p><a:r><a:t>Other</a:t></a:r></a:p></p:txBody></p:sp>`,
        ),
      }).key,
    ).toBe(key);
    expect(
      read({
        ...base,
        'ppt/slides/s.xml': root('sld', shape('s', solid('0000ff'))),
      }).key,
    ).not.toBe(key);
    const capped = read(
      fixture(
        root(
          'sld',
          Array.from({length: 70}, (_, index) => shape(String(index))).join(''),
        ),
      ),
    );
    expect(capped.layers).toHaveLength(64);
    expect(capped.skipped).toBe(6);
  });
});

describe('PowerPoint lyric colors', () => {
  const placeholder = (style = '') =>
    `<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle>${style}</a:lstStyle><a:p><a:r><a:t>Lyric</a:t></a:r></a:p></p:txBody></p:sp>`;
  const level = (fill: string) =>
    `<a:lvl1pPr><a:defRPr>${fill}</a:defRPr></a:lvl1pPr>`;
  const luminance = (parts: Record<string, string>) =>
    new PowerPointLayerReader(
      new PowerPointZip(powerpointArchive(parts)),
    ).lyricColor('ppt/slides/s.xml');
  it('inherits master body style, applies scheme mapping and respects layout override', () => {
    const master = root('sldMaster').replace(
      '</p:sldMaster>',
      `<p:txStyles><p:bodyStyle>${level('<a:solidFill><a:schemeClr val="bg1"/></a:solidFill>')}</p:bodyStyle></p:txStyles></p:sldMaster>`,
    );
    const parts = fixture(
      root('sld', placeholder()),
      root('sldLayout'),
      master,
    );
    expect(luminance(parts)).toBe(0x204060);
    parts['ppt/slideLayouts/l.xml'] = root(
      'sldLayout',
      placeholder(level(solid('ffffff'))),
    );
    expect(luminance(parts)).toBe(0xffffff);
    parts['ppt/slides/s.xml'] = root(
      'sld',
      placeholder(level(solid('000000'))),
    );
    expect(luminance(parts)).toBe(0);
    parts['ppt/slides/s.xml'] = root(
      'sld',
      placeholder(
        level(
          '<a:solidFill><a:srgbClr val="ffffff"><a:shade val="50000"/></a:srgbClr></a:solidFill>',
        ),
      ),
    );
    expect(luminance(parts)).toBe(0x808080);
  });
  it('ignores empty body placeholders before the lyric placeholder', () => {
    const empty = placeholder(level(solid('ffffff'))).replace('Lyric', '');
    const lyrics = placeholder(level(solid('000000')));
    expect(luminance(fixture(root('sld', empty + lyrics)))).toBe(0);
  });

  it('does not inherit a footer with the same placeholder index', () => {
    const lyrics = placeholder().replace('idx="1"', 'idx="2"');
    const footer = placeholder(level(solid('ffffff'))).replace(
      'type="body" idx="1"',
      'type="dt" idx="2"',
    );
    const master = root('sldMaster', footer).replace(
      '</p:sldMaster>',
      `<p:txStyles><p:bodyStyle>${level(solid('000000'))}</p:bodyStyle></p:txStyles></p:sldMaster>`,
    );
    expect(
      luminance(fixture(root('sld', lyrics), root('sldLayout'), master)),
    ).toBe(0);
  });
});
