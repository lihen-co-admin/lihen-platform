import { describe, expect, it } from 'vitest';
import { renderStaticContentPage } from '../src/components/static-content-page';
import { renderSiteFooter } from '../src/components/site-footer';

describe('QA-D institutional/social/legal content', () => {
  it('renders official LIHEN social channels on Nosotros', () => {
    const html = renderStaticContentPage('about');
    expect(html).toContain('https://www.instagram.com/lihen.co/');
    expect(html).toContain('https://www.facebook.com/lihen.co.oficial');
    expect(html).toContain('https://www.tiktok.com/@lihen.co');
  });

  it('renders source-backed shipping times and threshold', () => {
    const html = renderStaticContentPage('shipping');
    expect(html).toContain('1 a 3 días hábiles');
    expect(html).toContain('3 a 5 días hábiles');
    expect(html).toContain('5 a 8 días hábiles');
    expect(html).toContain('$100.000 COP');
  });

  it('keeps the SIC as a text link without endorsement language', () => {
    const html = `${renderStaticContentPage('consumer')} ${renderSiteFooter()}`;
    expect(html).toContain('sedeelectronica.sic.gov.co');
    expect(html).toContain('Protección al consumidor');
    expect(html).not.toMatch(/avalada por la SIC|certificada por la SIC|aprobado por la Superintendencia/i);
  });
});
