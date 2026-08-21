import type { ProfileRepository } from '../ports/profile-repository';
import type { UserProfile } from '../domain/user-profile';

export class InMemoryProfileRepository implements ProfileRepository {
  constructor(private readonly profiles: UserProfile[] = []) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.profiles.find((profile) => profile.id === userId) ?? null;
  }
}
