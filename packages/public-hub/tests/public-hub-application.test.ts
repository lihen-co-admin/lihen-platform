import { describe, expect, it } from 'vitest';
import {
  GetPublicHubBlocksHandler,
  ReorderPublicHubBlocksHandler,
  SavePublicHubBlockHandler,
  SetPublicHubBlockStatusHandler,
  type PublicHubBlockDraft,
  type PublicHubBlockProps,
  type PublicHubBlockStatus,
  type PublicHubRepository,
} from '../src';

class InMemoryPublicHubRepository implements PublicHubRepository {
  readonly blocks = new Map<string, PublicHubBlockProps>();
  lastOperationKey: string | null = null;
  sequence = 0;

  async listAdminBlocks(): Promise<readonly PublicHubBlockProps[]> {
    return [...this.blocks.values()].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async saveBlock(draft: PublicHubBlockDraft, operationKey: string): Promise<string> {
    this.lastOperationKey = operationKey;
    const id = draft.id ?? `hub-${++this.sequence}`;
    const previous = this.blocks.get(id);
    this.blocks.set(id, {
      id,
      blockType: draft.blockType,
      status: draft.status ?? previous?.status ?? 'DRAFT',
      sortOrder: draft.sortOrder ?? previous?.sortOrder ?? this.blocks.size,
      productId: draft.productId ?? null,
      collectionKey: draft.collectionKey ?? null,
      title: draft.title ?? null,
      subtitle: draft.subtitle ?? null,
      body: draft.body ?? null,
      ctaLabel: draft.ctaLabel ?? null,
      targetUrl: draft.targetUrl ?? null,
      imageUrl: draft.imageUrl ?? null,
      startsAt: draft.startsAt ?? null,
      endsAt: draft.endsAt ?? null,
      createdAt: previous?.createdAt ?? '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
    });
    return id;
  }

  async setStatus(id: string, status: PublicHubBlockStatus, operationKey: string): Promise<void> {
    this.lastOperationKey = operationKey;
    const block = this.blocks.get(id);
    if (!block) throw new Error('Bloque no encontrado.');
    this.blocks.set(id, { ...block, status });
  }

  async reorder(ids: readonly string[], operationKey: string): Promise<void> {
    this.lastOperationKey = operationKey;
    ids.forEach((id, index) => {
      const block = this.blocks.get(id);
      if (!block) throw new Error('Bloque no encontrado.');
      this.blocks.set(id, { ...block, sortOrder: index });
    });
  }
}

describe('Public Hub application workflow', () => {
  it('supports create, publish, reorder and admin read without bypassing handlers', async () => {
    const repository = new InMemoryPublicHubRepository();
    const save = new SavePublicHubBlockHandler(repository);
    const setStatus = new SetPublicHubBlockStatusHandler(repository);
    const reorder = new ReorderPublicHubBlocksHandler(repository);
    const get = new GetPublicHubBlocksHandler(repository);

    const firstId = await save.execute({
      blockType: 'LINK',
      title: 'Catálogo',
      targetUrl: 'https://lihen.co/catalogo',
    }, 'qa:create:1');
    const secondId = await save.execute({
      blockType: 'HEADING',
      title: 'Descubre LIHEN',
    }, 'qa:create:2');

    await setStatus.execute(firstId, 'PUBLISHED', 'qa:publish:1');
    await reorder.execute([secondId, firstId], 'qa:reorder:1');

    const blocks = await get.execute();
    expect(blocks.map((block) => block.id)).toEqual([secondId, firstId]);
    expect(blocks.find((block) => block.id === firstId)?.status).toBe('PUBLISHED');
    expect(repository.lastOperationKey).toBe('qa:reorder:1');
  });

  it('rejects invalid drafts before persistence', () => {
    const repository = new InMemoryPublicHubRepository();
    const save = new SavePublicHubBlockHandler(repository);

    expect(() => save.execute({ blockType: 'PRODUCT' }, 'qa:create:invalid')).toThrow(/producto canónico/i);
    expect(repository.blocks.size).toBe(0);
  });

  it('rejects duplicate reorder ids and blank audit keys', () => {
    const repository = new InMemoryPublicHubRepository();
    const reorder = new ReorderPublicHubBlocksHandler(repository);
    const setStatus = new SetPublicHubBlockStatusHandler(repository);

    expect(() => reorder.execute(['a', 'a'], 'qa:reorder')).toThrow(/duplicados/i);
    expect(() => setStatus.execute('a', 'HIDDEN', '   ')).toThrow(/auditoría/i);
  });
});
