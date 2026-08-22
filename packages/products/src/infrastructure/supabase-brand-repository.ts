import type { SupabaseClient } from '@supabase/supabase-js';
import { Brand, type BrandStatus } from '../domain/brand';
import type { BrandRepository } from '../ports/brand-repository';

interface BrandRow {
  readonly id: string;
  readonly name: string;
  readonly normalized_name: string;
  readonly status: BrandStatus;
}

const BRAND_COLUMNS = 'id,name,normalized_name,status';

function toBrand(row: BrandRow): Brand {
  return new Brand({
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    status: row.status,
  });
}

export class SupabaseBrandRepository implements BrandRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async findAll(): Promise<readonly Brand[]> {
    const { data, error } = await this.client
      .from('brands')
      .select(BRAND_COLUMNS)
      .order('name', { ascending: true });

    if (error) throw new Error(`Unable to read brands from Supabase: ${error.message}`);
    return ((data ?? []) as BrandRow[]).map(toBrand);
  }

  public async findById(id: string): Promise<Brand | null> {
    const { data, error } = await this.client
      .from('brands')
      .select(BRAND_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Unable to read brand from Supabase: ${error.message}`);
    return data ? toBrand(data as BrandRow) : null;
  }

  public async findByNormalizedName(normalizedName: string): Promise<Brand | null> {
    const { data, error } = await this.client
      .from('brands')
      .select(BRAND_COLUMNS)
      .eq('normalized_name', normalizedName.trim())
      .maybeSingle();

    if (error) throw new Error(`Unable to read brand by normalized name from Supabase: ${error.message}`);
    return data ? toBrand(data as BrandRow) : null;
  }
}
