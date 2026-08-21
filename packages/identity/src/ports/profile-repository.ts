import type { UserProfile } from '../domain/user-profile';

export interface ProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
}
