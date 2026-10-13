import { describe, expect, it, vi } from 'vitest';
import { createProductsComposition } from '../src/composition/products';
import {
  controlledDraftCreateCommand,
  fixedIdentityCreateHandler,
  confirmCreatedDraft,
} from '../src/composition/product-create-draft';
import { LocalFormDraft, type DraftStorage } from '../src/drafts/local-form-draft';
import {
  productCreateDraftCodec,
  emptyProductCreateDraft,
  createDraftTaxonomyError,
  productCreateReadbackValues,
} from '../src/drafts/product-create-draft';
import {
  SupabaseProductRepository,
  Product,
  DuplicateProductSkuError,
  type ProductDetailDTO,
} from '@lihen/products';
import { Money } from '@lihen/shared';

const id = '11111111-1111-4111-8111-111111111111';
const value = { ...emptyProductCreateDraft, name: 'Nuevo producto' };
function draft(storage?: DraftStorage) {
  const values = new Map<string, string>();
  const disk = storage ?? {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, data: string) => {
      values.set(key, data);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const session = new LocalFormDraft(
    disk,
    { userId: 'user-a', module: 'products', entity: 'new:' + id, form: 'create-identity' },
    productCreateDraftCodec,
    emptyProductCreateDraft,
  );
  session.edit(value);
  return { session, values };
}
const product: ProductDetailDTO = {
  id,
  ...value,
  slug: 'nuevo-producto',
  salePrice: { amount: 100, currency: 'COP' },
};

describe('controlled creation draft', () => {
  it.each(['salePrice', 'price', 'password', 'access_token', 'customerPhone', 'file'])(
    'rejects prohibited %s without storing it',
    (field) => {
      const { session, values } = draft();
      const before = [...values.values()];
      expect(() => session.edit({ ...value, [field]: 'private' })).toThrow();
      expect([...values.values()]).toEqual(before);
    },
  );

  it('retains operation and date through reload, but has no persisted price to replay', () => {
    const { session, values } = draft();
    const op = session.beginSave();
    const command = controlledDraftCreateCommand(op, 'user-a', value, 100);
    expect(command.commandId).toBe(op.key);
    expect(command.operationKey).toBe('product-master:create:' + op.key);
    expect(command.requestedAt.toISOString()).toBe(op.requestedAt);
    const record = JSON.parse([...values.values()][0]!);
    expect(record.value).not.toHaveProperty('salePrice');
    expect(record.operation.key).toBe(op.key);
    expect(() => session.beginSave()).toThrow('already in flight');
  });

  it('uses the same existing CreateProductHandler with a fixed provisional product ID', async () => {
    const composition = createProductsComposition({ VITE_PRODUCT_READ_SOURCE: 'memory' });
    const { session } = draft();
    const op = session.beginSave();
    const create = vi.spyOn(composition.repository, 'create');
    const created = await fixedIdentityCreateHandler(composition, id).execute(
      controlledDraftCreateCommand(op, 'user-a', value, 100),
    );
    expect(created.id).toBe(id);
    expect(create.mock.calls[0]?.[0].id).toBe(id);
    expect(create.mock.calls[0]?.[1]?.operationKey).toBe('product-master:create:' + op.key);
    expect(() => fixedIdentityCreateHandler(composition, 'invalid')).toThrow();
  });

  it('checks the actual Supabase repository RPC contract without making a network call', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          id,
          sku: null,
          catalog_code: null,
          slug: 'nuevo-producto',
          name: value.name,
          business_line: value.businessLine,
          brand_id: null,
          category_id: null,
          status: value.status,
          sale_price: 100,
        },
      ],
      error: null,
    }));
    const repository = new SupabaseProductRepository({ rpc } as never, {
      controlledCreateEnabled: true,
    });
    await repository.create(
      new Product({
        id,
        name: value.name,
        businessLine: value.businessLine,
        status: value.status,
        salePrice: new Money(100, 'COP'),
      }),
      { actorId: 'user-a', operationKey: 'stable' },
    );
    expect(rpc).toHaveBeenCalledWith(
      'create_product_controlled',
      expect.objectContaining({ p_id: id, p_operation_key: 'stable', p_sale_price: 100 }),
    );
  });

  it('proves handler replay can reject at duplicate SKU before reaching the repository write', async () => {
    const composition = createProductsComposition({ VITE_PRODUCT_READ_SOURCE: 'memory' });
    const { session } = draft();
    const op = session.beginSave();
    const handler = fixedIdentityCreateHandler(composition, id);
    const command = controlledDraftCreateCommand(op, 'user-a', { ...value, sku: 'NEW-SKU' }, 100);
    const create = vi.spyOn(composition.repository, 'create');
    await handler.execute(command);
    await expect(handler.execute(command)).rejects.toBeInstanceOf(DuplicateProductSkuError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('checks restored canonical brands and category lifecycle/business line', () => {
    expect(createDraftTaxonomyError({ ...value, brandId: 'deleted' }, [], [])).toContain('marca');
    expect(createDraftTaxonomyError({ ...value, categoryId: 'deleted' }, [], [])).toContain(
      'categoría',
    );
    expect(
      createDraftTaxonomyError(
        { ...value, categoryId: 'category-style' },
        [],
        [
          {
            id: 'category-style',
            name: 'Style',
            normalizedName: 'style',
            status: 'ACTIVE',
            businessLine: 'STYLE',
          },
        ],
      ),
    ).toContain('compatible');
    expect(createDraftTaxonomyError(value, [], [])).toBeNull();
  });

  it('cleans only after exact ID, restored identity and expected price readback', async () => {
    const composition = createProductsComposition({ VITE_PRODUCT_READ_SOURCE: 'memory' });
    const read = vi.spyOn(composition.getProductById, 'execute').mockResolvedValue(product);
    const { session, values } = draft();
    session.beginSave();
    session.markUncertain();
    expect(await confirmCreatedDraft(composition, session, id, 200)).toBe(false);
    expect(values.size).toBe(1);
    read.mockResolvedValueOnce({ ...product, name: 'Other content' });
    expect(await confirmCreatedDraft(composition, session, id, 100)).toBe(false);
    expect(await confirmCreatedDraft(composition, session, id, 100)).toBe(true);
    expect(values.size).toBe(0);
    expect(productCreateReadbackValues(product)).not.toHaveProperty('salePrice');
  });

  it('blocks dispatch identity when browser storage fails', () => {
    const { session } = draft({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    });
    expect(() => session.beginSave()).toThrow('no se envió');
    expect(session.getSnapshot().storageError).toBe(true);
  });
});
