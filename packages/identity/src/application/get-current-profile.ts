import type { ProfileRepository } from '../ports/profile-repository';
import type { UserProfile } from '../domain/user-profile';

export class GetCurrentProfileHandler {
  constructor(private readonly profiles: ProfileRepository) {}

  execute(userId: string): Promise<UserProfile | null> {
    if (!userId.trim()) throw new Error('USER_ID_REQUIRED');
    return this.profiles.findByUserId(userId);
  }
}
