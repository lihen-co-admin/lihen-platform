import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabasePublicHubRepository, type PublicHubBlockDraft } from '@lihen/public-hub';
import { parsePublicHubPayload } from '../../storefront/src/components/public-hub-api';
import { createPublicHubComposition } from '../src/composition/public-hub';

describe('Hub admin / public projection contract', () => {
  it('renders blocked configuration without constructing a Supabase client', async () => {
    const factory = vi.fn();
    const composition = createPublicHubComposition({}, factory);
    expect(composition.enabled).toBe(false);
    await expect(composition.getBlocks.execute()).rejects.toThrow('Hub bloqueado');
    expect(factory).not.toHaveBeenCalled();
    expect(createPublicHubComposition({VITE_PUBLIC_HUB_MODE:'controlled'}, factory).enabled).toBe(false);
  });
  it('maps the admin draft to RPC fields consumed by the public projection parser', async () => {
    const draft: PublicHubBlockDraft = {blockType:'LINK',status:'PUBLISHED',sortOrder:20,title:'Catálogo',subtitle:'Beauty',body:'Descubre',ctaLabel:'Ver',targetUrl:'https://example.com/catalog',imageUrl:'https://example.com/banner.webp'};
    const rpc = vi.fn().mockResolvedValue({data:'block-1',error:null});
    const repository = new SupabasePublicHubRepository({rpc} as unknown as SupabaseClient,true);
    expect(await repository.saveBlock(draft,'operation-1')).toBe('block-1');
    const args = rpc.mock.calls[0]![1] as Record<string,unknown>;
    expect(rpc.mock.calls[0]![0]).toBe('save_public_hub_block_controlled');
    expect(args).toMatchObject({p_operation_key:'operation-1',p_block_type:'LINK',p_title:'Catálogo',p_cta_label:'Ver',p_status:'PUBLISHED',p_starts_at:null,p_ends_at:null});
    // Contract fixture of get_public_hub_controlled: admin-only lifecycle/actor fields are absent.
    const projection = {block_id:'block-1',block_type:args.p_block_type,sort_order:args.p_sort_order,title:args.p_title,subtitle:args.p_subtitle,body:args.p_body,cta_label:args.p_cta_label,target_url:args.p_target_url,image_url:args.p_image_url,product_id:args.p_product_id,collection_key:args.p_collection_key,product_slug:null,product_name:null,product_brand:null,product_sale_price:null,product_availability:null};
    expect(parsePublicHubPayload([projection])).toEqual([projection]);
    expect(parsePublicHubPayload([{...projection,target_url:'javascript:alert(1)'}])).toEqual([]);
    rpc.mockResolvedValueOnce({data:[{...projection,id:'block-1',status:'PUBLISHED',starts_at:null,ends_at:null,created_at:null,updated_at:null}],error:null});
    expect((await repository.listAdminBlocks())[0]).toMatchObject(draft);
  });
  it('propagates read and write errors instead of acknowledging success', async () => {
    const rpc = vi.fn().mockResolvedValue({data:null,error:new Error('RLS denied')});
    const repository = new SupabasePublicHubRepository({rpc} as unknown as SupabaseClient,true);
    await expect(repository.listAdminBlocks()).rejects.toThrow('RLS denied');
    await expect(repository.saveBlock({blockType:'TEXT',body:'Hola'},'key')).rejects.toThrow('RLS denied');
  });
});
