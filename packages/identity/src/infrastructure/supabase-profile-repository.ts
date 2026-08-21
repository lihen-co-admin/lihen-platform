import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileRepository } from '../ports/profile-repository';
import { isAdminRoleCode } from '../domain/admin-role';
import { isAuthorizationStatus } from '../domain/authorization-status';
import type { UserProfile } from '../domain/user-profile';

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role_code: string;
  authorization_status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id,email,display_name,role_code,authorization_status,approved_by,approved_at,created_at,updated_at')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (error) throw error;
    if (!data) return null;
    if (!isAdminRoleCode(data.role_code)) throw new Error('INVALID_ADMIN_ROLE');
    if (!isAuthorizationStatus(data.authorization_status)) throw new Error('INVALID_AUTHORIZATION_STATUS');

    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      roleCode: data.role_code,
      authorizationStatus: data.authorization_status,
      approvedBy: data.approved_by,
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
