import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { assertAuditDatabase } from "../../scripts/drawing-performance-audit/run-config.mjs";
import { previewSymbolArtwork, replaceSymbolArtwork } from "../../src/features/symbol_registry/data/artwork";

assertAuditDatabase();
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><rect x="1" y="1" width="98" height="78" fill="#eeeeee" stroke="#555555"/></svg>';
const revised = svg.replace('#eeeeee','#ffffff').replace('#555555','#222222');
async function fixture() {
  const key = 'artwork-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
  const category = await prisma.symbolCategory.findFirstOrThrow();
  const metadataJson = JSON.stringify({symbolKey:key,displayName:key,category:'other',viewBox:{x:0,y:0,width:100,height:80},
    anchors:[{key:'L',x:20,y:60,kind:'terminal'}],terminals:[{key:'L',label:'Line',anchorKey:'L'}],
    physicalWidthMm:100,physicalHeightMm:80,layoutUsage:'both',extraLegacyValue:'preserved'});
  const symbol = await prisma.symbol.create({data:{symbolKey:key,displayName:key,category:'other',categoryId:category.id,status:'approved',
    versions:{create:{versionNumber:1,status:'approved',svg,metadataJson}}},include:{versions:true}});
  const item = await prisma.bomItem.create({data:{itemKey:key,displayName:'Artwork test item',category:'other',unit:'each'}});
  const bom = await prisma.symbolBomTemplate.create({data:{symbolId:symbol.id,notes:'preserve this',lines:{create:{itemId:item.id,lineNumber:1,quantityRule:'fixed_per_assembly',quantity:1}}},include:{lines:true}});
  return {symbol,item,bom,metadataJson};
}
test('preview, cancel, replace and reload preserve terminals and Item link', async ({page}) => {
  const f = await fixture(); const errors:string[]=[];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/symbols/${f.symbol.id}`);
  await page.getByRole('button',{name:'Replace artwork',exact:true}).click();
  const dialog = page.getByRole('dialog',{name:'Replace artwork',exact:true});
  await dialog.locator('input[type=file]').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg><script>alert(1)</script></svg>')});
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Save artwork'})).toBeDisabled();
  await dialog.locator('input[type=file]').setInputFiles({name:'new.svg',mimeType:'image/svg+xml',buffer:Buffer.from(revised)});
  await expect(dialog.getByText('Geometry checked · 1 terminals preserved')).toBeVisible();
  page.once('dialog', d => d.dismiss());
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button',{name:'Save artwork'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading',{name:'Version 2',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Version 2',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Show data for terminal L'})).toHaveCount(1);
  const saved = await prisma.symbolVersion.findMany({where:{symbolId:f.symbol.id},orderBy:{versionNumber:'asc'}});
  expect(saved).toHaveLength(2); expect(saved[0].svg).toBe(svg);
  expect(saved[1].svg).toBe(revised); expect(saved[1].metadataJson).toBe(f.metadataJson);
  expect(await prisma.symbolBomTemplate.findUnique({where:{id:f.bom.id},include:{lines:true}})).toEqual(f.bom);
  expect(errors).toEqual([]);
});
test('stale preview and archived records reject mutation; source-write failure rolls back', async () => {
  const f = await fixture();
  const input={symbolId:f.symbol.id,versionId:f.symbol.versions[0].id,fileName:'new.svg',svg:revised};
  const preview=await previewSymbolArtwork(input);
  await prisma.symbolVersion.update({where:{id:input.versionId},data:{metadataJson:f.metadataJson+' '}});
  await expect(replaceSymbolArtwork({...input,token:preview.token})).rejects.toThrow('changed after preview');
  // A synthetic trigger forces failure after version creation, proving rollback.
  const checked=await previewSymbolArtwork(input);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER artwork_fail_persist BEFORE INSERT ON SymbolSourceAsset WHEN NEW.symbolId = '${f.symbol.id}' BEGIN SELECT RAISE(ABORT, 'synthetic source failure'); END`);
  try { await expect(replaceSymbolArtwork({...input,token:checked.token})).rejects.toThrow(); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER artwork_fail_persist'); }
  expect(await prisma.symbolVersion.count({where:{symbolId:f.symbol.id}})).toBe(1);
  await prisma.symbol.update({where:{id:f.symbol.id},data:{status:'archived'}});
  await expect(previewSymbolArtwork(input)).rejects.toThrow('read-only');
});
test('narrow dialog stays accessible and metadata drafts disable replacement', async ({page}) => {
  const f=await fixture();
  await page.setViewportSize({width:360,height:740});
  await page.goto(`/symbols/${f.symbol.id}`);
  await page.getByRole('textbox',{name:'Symbol name',exact:true}).fill('Unsaved name');
  await expect(page.getByRole('button',{name:'Replace artwork',exact:true})).toBeDisabled();
  await page.getByRole('textbox',{name:'Symbol name',exact:true}).fill(f.symbol.displayName);
  await page.getByRole('button',{name:'Replace artwork',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Replace artwork',exact:true});
  await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button',{name:'Replace artwork',exact:true})).toBeFocused();
});
