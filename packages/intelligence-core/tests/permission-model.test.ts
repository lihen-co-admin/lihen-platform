import { describe, expect, it } from 'vitest';
import {
  GOVERNED_PERMISSION,
  INTELLIGENCE_PERMISSION,
  definePermissionKey,
  evaluatePermission,
} from '../src';
import type { PermissionPrincipal, PermissionRequest } from '../src';

const intelligencePrincipal: PermissionPrincipal = {
  actorId: 'lihen-intelligence',
  actorType: 'INTELLIGENCE',
  grants: [
    {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      effect: 'ALLOW',
      source: 'test-policy',
    },
    {
      permission: INTELLIGENCE_PERMISSION.CREATE_RECOMMENDATION,
      effect: 'ALLOW',
      source: 'test-policy',
    },
  ],
};

describe('LIHEN Intelligence Permission Model — GAP-004', () => {
  it('allows explicitly granted Intelligence read capability', () => {
    const decision = evaluatePermission(intelligencePrincipal, {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      actionClass: 'READ',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('GRANT_ALLOWED');
  });

  it('allows explicitly granted Intelligence proposal capability', () => {
    const decision = evaluatePermission(intelligencePrincipal, {
      permission: INTELLIGENCE_PERMISSION.CREATE_RECOMMENDATION,
      actionClass: 'PROPOSE',
    });

    expect(decision.allowed).toBe(true);
  });

  it('is default-deny when no matching grant exists', () => {
    const decision = evaluatePermission(intelligencePrincipal, {
      permission: INTELLIGENCE_PERMISSION.SEARCH_EXTERNAL,
      actionClass: 'READ',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('MISSING_GRANT');
  });

  it('blocks Intelligence autonomy for governed publication even if a bad ALLOW grant exists', () => {
    const principal: PermissionPrincipal = {
      actorId: 'lihen-intelligence',
      actorType: 'INTELLIGENCE',
      grants: [
        {
          permission: GOVERNED_PERMISSION.PUBLISH,
          effect: 'ALLOW',
          source: 'misconfigured-test-grant',
        },
      ],
    };

    const decision = evaluatePermission(principal, {
      permission: GOVERNED_PERMISSION.PUBLISH,
      actionClass: 'PUBLISH',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('INTELLIGENCE_AUTONOMY_BLOCK');
  });

  it('blocks Intelligence autonomy for finance and lifecycle operations', () => {
    for (const request of [
      { permission: GOVERNED_PERMISSION.POST_FINANCE, actionClass: 'FINANCE' },
      { permission: GOVERNED_PERMISSION.CHANGE_LIFECYCLE, actionClass: 'LIFECYCLE' },
    ] satisfies readonly PermissionRequest[]) {
      expect(evaluatePermission({
        actorId: 'lihen-intelligence',
        actorType: 'INTELLIGENCE',
        grants: [{ permission: request.permission, effect: 'ALLOW', source: 'bad-grant' }],
      }, request)).toMatchObject({
        allowed: false,
        reason: 'INTELLIGENCE_AUTONOMY_BLOCK',
      });
    }
  });

  it('gives explicit DENY precedence over ALLOW', () => {
    const principal: PermissionPrincipal = {
      actorId: 'human-1',
      actorType: 'HUMAN',
      grants: [
        {
          permission: GOVERNED_PERMISSION.APPROVE_CHANGE,
          effect: 'ALLOW',
          source: 'role-policy',
        },
        {
          permission: GOVERNED_PERMISSION.APPROVE_CHANGE,
          effect: 'DENY',
          source: 'temporary-restriction',
        },
      ],
    };

    expect(evaluatePermission(principal, {
      permission: GOVERNED_PERMISSION.APPROVE_CHANGE,
      actionClass: 'APPROVE',
    })).toMatchObject({
      allowed: false,
      reason: 'EXPLICIT_DENY',
    });
  });

  it('respects scoped grants', () => {
    const principal: PermissionPrincipal = {
      actorId: 'human-2',
      actorType: 'HUMAN',
      grants: [{
        permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
        effect: 'ALLOW',
        source: 'scope-policy',
        scope: { domain: 'PRODUCT', businessLine: 'STYLE' },
      }],
    };

    const allowed = evaluatePermission(principal, {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      actionClass: 'READ',
      scope: { domain: 'PRODUCT', businessLine: 'STYLE' },
    });

    const denied = evaluatePermission(principal, {
      permission: INTELLIGENCE_PERMISSION.READ_CONTEXT,
      actionClass: 'READ',
      scope: { domain: 'PRODUCT', businessLine: 'BEAUTY_CARE' },
    });

    expect(allowed.allowed).toBe(true);
    expect(denied).toMatchObject({ allowed: false, reason: 'MISSING_GRANT' });
  });

  it('supports future domain permissions without changing the engine', () => {
    const futurePermission = definePermissionKey('social', 'publication_publish');

    expect(futurePermission).toBe('social.publication_publish');

    const decision = evaluatePermission({
      actorId: 'human-social-admin',
      actorType: 'HUMAN',
      grants: [{ permission: futurePermission, effect: 'ALLOW', source: 'future-role-policy' }],
    }, {
      permission: futurePermission,
      actionClass: 'PUBLISH',
    });

    expect(decision.allowed).toBe(true);
  });

  it('a future permission key does not become granted by being definable', () => {
    const futurePermission = definePermissionKey('social', 'metrics_read');

    expect(evaluatePermission({
      actorId: 'human-no-social-grant',
      actorType: 'HUMAN',
      grants: [],
    }, {
      permission: futurePermission,
      actionClass: 'READ',
    })).toMatchObject({
      allowed: false,
      reason: 'MISSING_GRANT',
    });
  });

  it('rejects malformed permission segments', () => {
    expect(() => definePermissionKey('social.publication', 'publish')).toThrow();
    expect(() => definePermissionKey('social', '')).toThrow();
  });
});
