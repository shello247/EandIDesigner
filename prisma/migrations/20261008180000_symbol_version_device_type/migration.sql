-- Additive only: historical artwork, metadata, Item revisions and categories
-- remain byte-for-byte unchanged. Classification is adopted explicitly later.
ALTER TABLE "SymbolVersion" ADD COLUMN "deviceType" TEXT;
CREATE INDEX "SymbolVersion_deviceType_idx" ON "SymbolVersion"("deviceType");
