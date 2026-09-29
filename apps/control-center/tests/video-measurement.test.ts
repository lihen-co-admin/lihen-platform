import { describe, expect, it, vi } from 'vitest';
import { measureMovie, measureGovernedVideo, VIDEO_BYTE_LIMIT } from '../../../supabase/functions/marketing-social-runtime/video-measurement';
const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0,n); return b; };
const join = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((s,b)=>s+b.length,0)); let p=0; for(const b of parts){out.set(b,p);p+=b.length;} return out; };
const ascii = (s: string) => new TextEncoder().encode(s);
const box = (type: string,...parts: Uint8Array[]) => { const body=join(...parts);return join(u32(body.length+8),ascii(type),body); };
export const videoUrl = 'https://media.invalid/storage/v1/object/public/lihen-editorial-video/products/00000000-0000-0000-0000-000000000001/reels/00000000-0000-0000-0000-000000000002.mp4';
export function movie(seconds = 12) {
  const header=join(new Uint8Array(12),u32(1000),u32(seconds*1000));
  return join(box('ftyp',ascii('isom'),u32(0)),box('moov',box('mvhd',header),box('trak',box('mdia',box('mdhd',header),box('hdlr',new Uint8Array(8),ascii('vide')),box('minf',box('stbl',box('stts',u32(0),u32(1),u32(seconds),u32(1000)),box('stsz',u32(0),u32(1),u32(seconds))))))),box('mdat',new Uint8Array(seconds)));
}
export function mediaResponse(bytes = movie(), headers: Record<string,string> = {}) {
  return new Response(bytes, {headers:{'content-type':'video/mp4','content-length':String(bytes.length),etag:'"version-1"',...headers}});
}
describe('server measurement of governed MP4 bytes',()=>{
  it('measures sample timing and binds the actual bytes to hash and ETag',async()=>{
    const request=vi.fn(async()=>mediaResponse());
    expect(measureMovie(movie())).toBe(12);
    const result=await measureGovernedVideo(videoUrl,'https://media.invalid','https://media.invalid/',new AbortController().signal,request);
    expect(result).toMatchObject({durationSeconds:12,etag:'"version-1"',bytes:movie().length,method:'ISO_BMFF_SAMPLE_TABLES_V1'});
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(request.mock.calls).toHaveLength(1);
  });
  it.each([new Uint8Array(),new Uint8Array(64),movie().slice(0,-1)])('rejects malformed/truncated movies',bytes=>expect(()=>measureMovie(bytes)).toThrow());
  it('rejects inconsistent movie versus sample timing',()=>{
    const bytes=movie(); const index=Buffer.from(bytes).indexOf('stts');new DataView(bytes.buffer).setUint32(index+16,900);
    expect(()=>measureMovie(bytes)).toThrow();
  });
  it.each(['https://evil.invalid/a.mp4','https://media.invalid/arbitrary.mp4',videoUrl+'?redirect=x'])('rejects boundary violations before HTTP',async url=>{
    const request=vi.fn();await expect(measureGovernedVideo(url,'https://media.invalid','https://media.invalid/',new AbortController().signal,request)).rejects.toThrow();expect(request).not.toHaveBeenCalled();
  });
  it.each([{etag:'W/"weak"'},{'content-length':String(VIDEO_BYTE_LIMIT+1)},{'content-length':'0'},{'content-type':'text/html'},{'content-encoding':'gzip'}])('rejects unverifiable response %j',async headers=>{
    await expect(measureGovernedVideo(videoUrl,'https://media.invalid','https://media.invalid/',new AbortController().signal,async()=>mediaResponse(movie(),headers))).rejects.toThrow();
  });
  it('rejects redirect and unavailable media',async()=>{
    for(const status of [302,404,503])await expect(measureGovernedVideo(videoUrl,'https://media.invalid','https://media.invalid/',new AbortController().signal,async()=>new Response(null,{status}))).rejects.toThrow();
  });
  it('does not initialize without measurement, on over-duration or changed bytes',async()=>{
    const {createTikTokHttpTransport}=await import('../../../supabase/functions/marketing-social-runtime/tiktok-http');
    const request=vi.fn(async (_url: unknown, init?: RequestInit)=>init?.method==='HEAD'?new Response(null,{headers:{etag:'"changed"','content-length':String(movie().length)}}):mediaResponse());
    const transport=createTikTokHttpTransport({enabled:true,accessToken:'fake',audited:false,mediaOrigin:'https://media.invalid',verifiedUrlPrefix:'https://media.invalid/',authorizedScopes:['video.publish']},null,request);
    const input={videoUrl,caption:'copy',choices:{creatorRevision:'r',privacy:'SELF_ONLY',consent:true as const,interactions:{comment:false,duet:false,stitch:false},disclosure:{ownBrand:false,brandedContent:false,musicUsageAccepted:true as const}}};
    await expect(transport.initialize(input,new AbortController().signal)).rejects.toThrow('DURATION_VERIFICATION');
    expect(await transport.verifyVideo({publicUrl:videoUrl,mediaType:'VIDEO'},new AbortController().signal,11)).toBe(false);
    expect(await transport.verifyVideo({publicUrl:videoUrl,mediaType:'VIDEO'},new AbortController().signal,12)).toBe(true);
    await expect(transport.initialize(input,new AbortController().signal)).rejects.toThrow('VIDEO_CHANGED');
    expect(request.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  });
});
