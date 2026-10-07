import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ControlCenterReadiness } from '../src/components/ControlCenterReadiness';
const render = (integrity: {status:string;issueCount:number}[], authorized = false) => renderToStaticMarkup(createElement(ControlCenterReadiness,{env:{},authorized,role:'ADMIN',integrity}));
describe('DEV closure readiness', () => {
  it('shows no PASS or global readiness from missing observations', () => {
    const html=render([]);
    expect(html).toContain('0 comprobaciones RPC recibidas');
    expect(html).toContain('<td>INTEGRIDAD OPERACIONAL</td><td>REVIEW</td>');
    expect(html).toContain('<td>AUTH OWNER/ADMIN</td><td>BLOCKED</td>');
  });
  it('derives integrity from actual results and keeps final execution held', () => {
    expect(render([{status:'PASS',issueCount:0}],true)).toContain('<td>INTEGRIDAD OPERACIONAL</td><td>READY</td>');
    const failed=render([{status:'FAIL',issueCount:1}],true);
    expect(failed).toContain('<td>INTEGRIDAD OPERACIONAL</td><td>BLOCKED</td>');
    expect(failed).toContain('<td>EJECUCIÓN FINAL</td><td>BLOCKED</td>');
    expect(failed).not.toContain('<button');
  });
});
