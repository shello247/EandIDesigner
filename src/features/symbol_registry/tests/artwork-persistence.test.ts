import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), createVersion: vi.fn(), createSource: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { symbol: {findUnique: db.findUnique}, $transaction: db.transaction } }));
import { previewSymbolArtwork, replaceSymbolArtwork } from "../data/artwork";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect width="100" height="80" fill="#eeeeee"/></svg>';
const metadataJson = JSON.stringify({ symbolKey:'ups', displayName:'UPS', category:'other',
  viewBox:{x:0,y:0,width:100,height:80}, anchors:[], terminals:[], legacyPreserved:'exact value' });
function stored() { return { id:'s', status:'approved', updatedAt:new Date('2026-01-01'),
  versions:[{id:'v', versionNumber:1,status:'approved',svg,metadataJson,_count:{itemConfigurations:0}}] }; }
const input = {symbolId:'s', versionId:'v', fileName:'light.svg',svg:svg.replace('#eeeeee','#ffffff')};
beforeEach(() => {
  vi.resetAllMocks(); db.findUnique.mockResolvedValue(stored()); db.updateMany.mockResolvedValue({count:1});
  db.createVersion.mockResolvedValue({id:'v2',versionNumber:2});
  db.transaction.mockImplementation(async fn => fn({symbol:{findUnique:db.findUnique,updateMany:db.updateMany},symbolVersion:{create:db.createVersion},symbolSourceAsset:{create:db.createSource}}));
});
describe('artwork persistence', () => {
  it('appends while preserving raw metadata and status; never writes BOM, Items or drawings', async () => {
    const preview = await previewSymbolArtwork(input);
    expect(db.createVersion).not.toHaveBeenCalled();
    await expect(replaceSymbolArtwork({...input,token:preview.token})).resolves.toEqual({versionId:'v2',versionNumber:2});
    expect(db.createVersion).toHaveBeenCalledWith({data:expect.objectContaining({metadataJson,status:'approved',symbolId:'s',versionNumber:2})});
    expect(db.createSource).toHaveBeenCalledWith({data:expect.objectContaining({versionId:'v2',fileName:'light.svg'})});
  });
  it.each(['archived','version','configured'])('fails closed for %s', async kind => {
    const record = stored();
    if(kind==='archived') record.status='archived';
    if(kind==='version') record.versions[0].id='new-version';
    if(kind==='configured') record.versions[0]._count.itemConfigurations=1;
    db.findUnique.mockResolvedValue(record);
    await expect(previewSymbolArtwork(input)).rejects.toThrow(); expect(db.createVersion).not.toHaveBeenCalled();
  });
  it('retains drafts on source drift and rejects stale save', async () => {
    const preview = await previewSymbolArtwork(input);
    const changed = stored(); changed.versions[0].metadataJson += ' ';
    db.findUnique.mockResolvedValue(changed);
    await expect(replaceSymbolArtwork({...input,token:preview.token})).rejects.toThrow('changed after preview');
    expect(db.createVersion).not.toHaveBeenCalled();
  });
  it('aborts when lock or source insert fails', async () => {
    const preview = await previewSymbolArtwork(input);
    db.updateMany.mockResolvedValueOnce({count:0});
    await expect(replaceSymbolArtwork({...input,token:preview.token})).rejects.toThrow('changed');
    expect(db.createVersion).not.toHaveBeenCalled();
    db.createSource.mockRejectedValueOnce(new Error('disk failure'));
    await expect(replaceSymbolArtwork({...input,token:preview.token})).rejects.toThrow('disk failure');
  });
});
