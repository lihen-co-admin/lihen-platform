import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CapabilityModeNotice } from '../src/components/CapabilityModeNotice';
describe('commerce capability modes', () => {
  it.each(['products','inventory','suppliers','purchases','orders','sales','finance'])('labels %s memory capability as simulation', (route) => {
    const html = renderToStaticMarkup(createElement(CapabilityModeNotice, {pathname:`/${route}`,env:{}}));
    expect(html).toContain('SIMULACIÓN EN MEMORIA');
    expect(html).toContain('blocked (BLOCKED)');
  });
  it('does not present controlled orders without durable dependencies as ready', () => {
    const html = renderToStaticMarkup(createElement(CapabilityModeNotice, {pathname:'/orders',env:{VITE_ORDER_WRITE_MODE:'controlled'}}));
    expect(html).toContain('controlled (REVIEW)');
    expect(html).not.toContain('(READY)');
  });
});
