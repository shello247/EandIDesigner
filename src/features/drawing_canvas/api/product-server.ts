export {loadDrawingProducts,validateDrawingProductSelections} from "../data/product-selections";
import type {loadDrawingProducts} from "../data/product-selections";
export type ResolvedDrawingProduct=Awaited<ReturnType<typeof loadDrawingProducts>>[number];
