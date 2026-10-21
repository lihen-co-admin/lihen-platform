import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readBackup } from '../../tooling/pages-dev/restore-verified-backup.mjs';
function archive(names: { name: string; type?: string }[]) {
  const blocks: Buffer[] = [];
  for (const { name, type = '0' } of names) {
    const body = Buffer.from('<html>TEST RECOVERY</html>');
    const h = Buffer.alloc(512);
    h.write(name);
    h.write('0000644\0', 100);
    h.write('0000000\0', 108);
    h.write('0000000\0', 116);
    h.write(body.length.toString(8).padStart(11, '0') + '\0', 124);
    h.write('00000000000\0', 136);
    h.fill(32, 148, 156);
    h.write(type, 156);
    h.write('ustar\0', 257);
    let sum = 0;
    for (const x of h) sum += x;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, body, Buffer.alloc(512 - body.length));
  }
  blocks.push(Buffer.alloc(1024));
  const tar = Buffer.concat(blocks),
    n = Buffer.from('artifact.tar'),
    local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt32LE(tar.length, 18);
  local.writeUInt32LE(tar.length, 22);
  local.writeUInt16LE(n.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt32LE(tar.length, 20);
  central.writeUInt32LE(tar.length, 24);
  central.writeUInt16LE(n.length, 28);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + n.length, 12);
  end.writeUInt32LE(local.length + n.length + tar.length, 16);
  return Buffer.concat([local, n, tar, central, n, end]);
}
const sites = [{ name: 'control-center/index.html' }, { name: 'storefront/index.html' }];
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
describe('Pages manual gate and pinned recovery', () => {
  it('has no push trigger and deploy is explicitly true-only', () => {
    const s = readFileSync('.github/workflows/pages-dev.yml', 'utf8');
    expect(s).not.toMatch(/^ {2}push:/m);
    expect(s).toContain('workflow_dispatch:');
    expect(s).toContain(
      "if: github.event_name == 'workflow_dispatch' && inputs.deploy_dev == true",
    );
    expect(s).toMatch(/deploy_dev:[\s\S]*?type: boolean\s+default: false/);
    expect(s.split('  deploy:')[0]).not.toContain('actions/configure-pages');
  });
  it('preserves Storefront and provides full restore without rebuilding', () => {
    const s = readFileSync('.github/workflows/pages-dev.yml', 'utf8');
    expect(s).not.toContain('pnpm --filter @lihen/storefront build');
    expect(s).toContain('cp -R recovery-site/storefront/. pages-artifact/storefront/');
    expect(s).toContain('cp -R recovery-site/. pages-artifact/');
    expect(s).toContain('if: inputs.restore_backup == false');
    expect(s).toContain('restore-verified-backup.mjs');
  });
  it('restores both sites exactly', () => {
    const b = archive(sites);
    expect([...readBackup(b, sha(b)).files.keys()]).toEqual(sites.map((x) => x.name));
  });
  it('rejects a changed checksum', () =>
    expect(() => readBackup(archive(sites), 'bad')).toThrow('BACKUP_SHA256_MISMATCH'));
  it.each(['../escape', '/absolute', 'control-center/../../escape'])(
    'rejects unsafe path %s',
    (name) => {
      const b = archive([...sites, { name }]);
      expect(() => readBackup(b, sha(b))).toThrow('TAR_PATH_UNSAFE');
    },
  );
  it('rejects links', () => {
    const b = archive([...sites, { name: 'control-center/link', type: '2' }]);
    expect(() => readBackup(b, sha(b))).toThrow('TAR_LINK_OR_TYPE_BLOCKED');
  });
  it('requires both sites', () => {
    const b = archive(sites.slice(0, 1));
    expect(() => readBackup(b, sha(b))).toThrow('BOTH_SITES_REQUIRED');
  });
});
