"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadProductConfigurationWorkspace, saveProductConfiguration, searchProductItems } from "../data/product-configurations";
import { itemEngineeringActionResult } from "../logic/services/item-engineering-action-result";
import {resolveProductSelections} from "../data/selected-products";
import {drawingProductSelectionSchema} from "../data/product-selection-schema";
export async function loadProductConfigurationAction(input:unknown){
  return itemEngineeringActionResult(()=>loadProductConfigurationWorkspace(z.string().trim().min(1).max(160).parse(input)));
}
export async function saveProductConfigurationAction(input:unknown){
  return itemEngineeringActionResult(async()=>{const result=await saveProductConfiguration(input);revalidatePath("/symbols");return result;});
}
export async function searchProductItemsAction(input:unknown){
  return itemEngineeringActionResult(()=>searchProductItems(z.string().max(160).parse(input)));
}
export async function loadSelectedProductAction(input:unknown){
  return itemEngineeringActionResult(async()=>{
    const parsed=z.strictObject({versionId:z.string().min(1).max(160),selection:drawingProductSelectionSchema.optional()}).parse(input);
    const [workspace,resolved]=await Promise.all([loadProductConfigurationWorkspace(parsed.versionId),resolveProductSelections([{...parsed,key:"subject"}])]);
    return {workspace,selected:resolved[0]};
  });
}
