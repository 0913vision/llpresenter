import {describe, expect, it} from 'vitest';
import {readPowerPoint} from '@main/import/pptx/powerpointDeck';
import {powerpointSlides} from '@core/songs/powerpointSlides';
import {
  archive,
  ns,
  rel,
  rels,
  shape,
  slide,
} from '@fixtures/main/import/powerpointArchive';

describe('PowerPoint XML reader', () => {
  it('takes a slide as a picture only when its one picture covers it as it is, or its background is one', () => {
    const picture = (frame: string, extra = '') =>
      `<p:pic><p:blipFill><a:blip r:embed="pic"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm${extra}>${frame}</a:xfrm></p:spPr></p:pic>`;
    const whole = '<a:off x="0" y="0"/><a:ext cx="1600" cy="900"/>';
    const half = '<a:off x="0" y="0"/><a:ext cx="800" cy="900"/>';
    const slides = [
      picture(whole),
      picture(half),
      picture(whole, ' flipH="1"'),
      picture(whole) + picture(whole),
      '',
    ];
    const ids = slides.map((_, n) => `<p:sldId r:id="r${n + 1}"/>`).join('');
    const parts: Record<string, string> = {
      'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="1600" cy="900"/></p:presentation>`,
      'ppt/_rels/presentation.xml.rels': rels(
        slides
          .map((_, n) => rel(`r${n + 1}`, `slides/slide${n + 1}.xml`, 'slide'))
          .join(''),
      ),
    };
    slides.forEach((content, n) => {
      const extra =
        content === ''
          ? '<p:bg><p:bgPr><a:blipFill><a:blip r:embed="pic"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></p:bgPr></p:bg>'
          : '';
      parts[`ppt/slides/slide${n + 1}.xml`] = slide(content, extra);
      parts[`ppt/slides/_rels/slide${n + 1}.xml.rels`] = rels(
        rel('pic', '../media/p.png'),
      );
    });
    const deck = readPowerPoint(archive(parts));
    expect(deck.slides.map(s => s.picture !== undefined)).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('reads titles, grouped body, breaks, blanks, hidden slides and inherited backgrounds', () => {
    const title = shape('Title') + shape('Subtitle');
    const body = `<p:grpSp><p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>First &amp; line</a:t></a:r><a:br/><a:r><a:t>Second  </a:t></a:r></a:p></p:txBody></p:sp></p:grpSp>`;
    const ids = [1, 2, 3, 4, 5].map(n => `<p:sldId r:id="r${n}"/>`).join('');
    const parts: Record<string, string> = {
      'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="1600" cy="900"/></p:presentation>`,
      'ppt/_rels/presentation.xml.rels': rels(
        [1, 2, 3, 4, 5]
          .map(n => rel(`r${n}`, `slides/slide${n}.xml`, 'slide'))
          .join(''),
      ),
      'ppt/slides/slide1.xml': slide(
        title,
        '<p:bg><p:bgPr><a:blipFill><a:blip r:embed="bg"/></a:blipFill></p:bgPr></p:bg>',
      ),
      'ppt/slides/_rels/slide1.xml.rels': rels(rel('bg', '../media/bg.png')),
      'ppt/slides/slide2.xml': slide(shape('Decoration') + body),
      'ppt/slides/_rels/slide2.xml.rels': rels(
        rel('layout', '../slideLayouts/layout1.xml', 'slideLayout'),
      ),
      'ppt/slideLayouts/layout1.xml': `<p:sldLayout ${ns}><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="pic"/></p:blipFill><p:spPr><a:xfrm><a:ext cx="100" cy="100"/></a:xfrm></p:spPr></p:pic></p:spTree></p:cSld></p:sldLayout>`,
      'ppt/slideLayouts/_rels/layout1.xml.rels': rels(
        rel('pic', '../media/layout.jpg'),
      ),
      'ppt/slides/slide3.xml': slide(''),
      'ppt/slides/slide4.xml': slide(title),
      'ppt/slides/slide5.xml': slide(shape('Hidden'), '', 'show="0"'),
    };
    const deck = readPowerPoint(archive(parts));
    expect(deck.slides.map(s => s.number)).toEqual([1, 2, 3, 4]);
    expect(deck.slides.map(s => s.background)).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
    expect(powerpointSlides(deck.slides)).toEqual([
      {titleSlide: true, lines: ['Title', 'Subtitle']},
      {lines: ['First & line', 'Second']},
      {lines: []},
      {titleSlide: true, lines: ['Title', 'Subtitle']},
    ]);
    const ten = archive({
      ...parts,
      'ppt/presentation.xml':
        parts['ppt/presentation.xml']?.replace('cy="900"', 'cy="1000"') ?? '',
    });
    const nonStandard = readPowerPoint(ten);
    expect(nonStandard.widescreen).toBe(false);
    expect(nonStandard.slides[0]?.background).toMatch(/^[a-f0-9]{64}$/);
  });
});
