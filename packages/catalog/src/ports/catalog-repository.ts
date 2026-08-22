import type { CatalogEntry } from '../domain/catalog-entry';
import type { CatalogVersion } from '../domain/catalog-version';

export interface CatalogRepository {
  listVersions(): Promise<readonly CatalogVersion[]>;
  getVersionById(id: string): Promise<CatalogVersion | null>;
  listEntries(versionId: string): Promise<readonly CatalogEntry[]>;
}
