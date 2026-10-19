import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  enabled: true,
  loading: false,
  authorizationLoading: false,
  authorized: true,
  session: { user: { id: 'owner' } } as { user: { id: string } } | null,
  profile: { id: 'owner', roleCode: 'OWNER', authorizationStatus: 'ACTIVE' } as {
    id: string;
    roleCode: string;
    authorizationStatus: string;
  } | null,
}));
vi.mock('../src/auth/auth-context', () => ({ useAuth: () => state }));
import { ProtectedRoute } from '../src/auth/ProtectedRoute';
const render = () =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      {},
      createElement(
        Routes,
        {},
        createElement(Route, { path: '/login', element: createElement('h1', {}, 'LOGIN') }),
        createElement(
          Route,
          { element: createElement(ProtectedRoute) },
          createElement(Route, {
            path: '/',
            element: createElement('input', { 'aria-label': 'Work', defaultValue: 'unsaved' }),
          }),
        ),
      ),
    ),
  );
beforeEach(() => {
  state.loading = false;
  state.authorized = true;
  state.authorizationLoading = false;
  state.session = { user: { id: 'owner' } };
  state.profile = { id: 'owner', roleCode: 'OWNER', authorizationStatus: 'ACTIVE' };
});
describe('shared authorization boundary stability', () => {
  it('preserves the routed form but makes it inert while the same verified user is revalidated', () => {
    state.authorizationLoading = true;
    const html = render();
    expect(html).toContain('value="unsaved"');
    expect(html).toContain('inert=""');
    expect(html).toContain('role="status"');
  });
  it('does not block the verified route after validation', () => {
    const html = render();
    expect(html).toContain('value="unsaved"');
    expect(html).not.toContain('inert=');
  });
  it('does not mount the route before initial authorization', () => {
    state.profile = null;
    state.authorized = false;
    state.authorizationLoading = true;
    expect(render()).not.toContain('<input');
    expect(render()).toContain('Validando');
  });
  it('does not expose the previous user route during an identity change', () => {
    state.session = { user: { id: 'another' } };
    state.authorizationLoading = true;
    expect(render()).not.toContain('<input');
  });
  it('fails closed on a completed profile belonging to another user', () => {
    state.session = { user: { id: 'another' } };
    const html = render();
    expect(html).not.toContain('<input');
    expect(html).toContain('Acceso no autorizado');
  });
  it('denies a revoked profile instead of retaining its routed subtree', () => {
    state.authorized = false;
    state.profile!.authorizationStatus = 'INACTIVE';
    const html = render();
    expect(html).not.toContain('<input');
    expect(html).toContain('Acceso no autorizado');
  });
});
