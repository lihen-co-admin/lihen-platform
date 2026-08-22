import type { SupabaseClient } from '@supabase/supabase-js';
import { Category, type CategoryStatus } from '../domain/category';
import type { BusinessLine } from '../domain/business-line';
import type { CategoryRepository } from '../ports/category-repository';

interface CategoryRow {
  readonly id: string;
  readonly name: string;
  readonly normalized_name: string;
  readonly business_line: BusinessLine;
  readonly parent_id: string | null;
  readonly status: CategoryStatus;
}

const CATEGORY_COLUMNS = 'id,name,normalized_name,business_line,parent_id,status';

function toCategory(row: CategoryRow): Category {
  return new Category({
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    businessLine: row.business_line,
    ...(row.parent_id ? { parentId: row.parent_id } : {}),
    status: row.status,
  });
}

export class SupabaseCategoryRepository implements CategoryRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async findAll(): Promise<readonly Category[]> {
    const { data, error } = await this.client
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`Unable to read categories from Supabase: ${error.message}`);
    return ((data ?? []) as CategoryRow[]).map(toCategory);
  }

  public async findById(id: string): Promise<Category | null> {
    const { data, error } = await this.client
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Unable to read category from Supabase: ${error.message}`);
    return data ? toCategory(data as CategoryRow) : null;
  }

  public async findByNormalizedName(normalizedName: string): Promise<Category | null> {
    const { data, error } = await this.client
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .eq('normalized_name', normalizedName.trim())
      .maybeSingle();

    if (error) throw new Error(`Unable to read category by normalized name from Supabase: ${error.message}`);
    return data ? toCategory(data as CategoryRow) : null;
  }
}
