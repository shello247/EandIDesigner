import { expect, test, type Page, type Request } from "@playwright/test";
import { performance } from "node:perf_hooks";
import { guard, write } from "../drawing-performance-audit/common";
import { seed } from "../drawing-performance-audit/fixtures";

guard();
const phase = process.env.AUDIT_PHASE ?? "transport";

type RequestRecord = {
  method: string;
  path: string;
  rsc: boolean;
  prefetch: boolean;
};

type ActionTransfer = {
  requestId: string;
  responseBodyBytes: number;
  responseTransferBytes: number;
};

function requestRecord(request: Request): RequestRecord {
  const url = new URL(request.url());
  const headers = request.headers();
  return {
    method: request.method(),
    path: url.pathname,
    rsc: headers.rsc === "1" || url.searchParams.has("_rsc"),
    prefetch:
      headers["next-router-prefetch"] === "1" ||
      headers.purpose === "prefetch" ||
      headers["sec-purpose"] === "prefetch"
  };
}

function unrelatedPrefetch(records: RequestRecord[]) {
  return records.filter(
    (record) =>
      record.method === "GET" &&
      (record.rsc || record.prefetch) &&
      ["/symbols", "/networking", "/bom"].some(
        (root) => record.path === root || record.path.startsWith(`${root}/`)
      )
  );
}

async function ready(page: Page) {
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible({
    timeout: 60000
  });
  await expect(page.getByRole("button", { name: "Open sheet loader" })).toBeEnabled();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

async function waitForStableTransfer(page: Page, transfer: ActionTransfer) {
  let previousBytes = -1;
  let stableChecks = 0;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (
      transfer.responseBodyBytes > 0 &&
      transfer.responseBodyBytes === previousBytes
    ) {
      stableChecks += 1;
      if (stableChecks >= 3) return;
    } else {
      previousBytes = transfer.responseBodyBytes;
      stableChecks = 0;
    }
    await page.waitForTimeout(25);
  }

  throw new Error("The save response byte count did not stabilize.");
}

test("measures save transport, rejects unrelated prefetch, and keeps explicit navigation fresh", async ({
  page
}) => {
  test.setTimeout(120000);
  await seed();

  const records: RequestRecord[] = [];
  const transfers: ActionTransfer[] = [];
  const transfersById = new Map<string, ActionTransfer>();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  cdp.on(
    "Network.requestWillBeSent",
    (event: {
      requestId: string;
      request: { method: string; url: string };
    }) => {
      if (
        event.request.method !== "POST" ||
        new URL(event.request.url).pathname !== "/drawings/audit_mixed_40"
      ) {
        return;
      }
      const transfer = {
        requestId: event.requestId,
        responseBodyBytes: 0,
        responseTransferBytes: 0
      };
      transfers.push(transfer);
      transfersById.set(event.requestId, transfer);
    }
  );
  cdp.on(
    "Network.dataReceived",
    (event: { requestId: string; dataLength: number; encodedDataLength: number }) => {
      const transfer = transfersById.get(event.requestId);
      if (!transfer) return;
      transfer.responseBodyBytes += event.dataLength;
      transfer.responseTransferBytes += event.encodedDataLength;
    }
  );
  page.on("request", (request) => records.push(requestRecord(request)));
  await page.goto("/drawings/audit_mixed_40");
  await ready(page);

  const loadRecords = records.splice(0);
  const loadUnrelated = unrelatedPrefetch(loadRecords);
  await page
    .locator(
      'svg[aria-label="Interactive drawing overlay"] rect[data-placement-id="g0_device_0"]'
    )
    .click({ force: true });

  const samples: Array<{
    elapsedMs: number;
    requestBytes: number;
    responseBytes: number;
    responseTransferBytes: number;
    records: RequestRecord[];
    unrelatedPrefetch: RequestRecord[];
  }> = [];

  for (let iteration = 0; iteration < 35; iteration += 1) {
    await page.getByTestId("drawing-canvas-viewport").focus();
    await page.keyboard.press(iteration % 2 === 0 ? "ArrowRight" : "ArrowLeft");
    records.length = 0;
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/drawings/audit_mixed_40"
    );
    const started = performance.now();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const response = await responsePromise;
    await expect(page.getByRole("button", { name: "Drawing saved" })).toBeVisible();
    const transfer = transfers.at(-1);
    expect(transfer).toBeDefined();
    await waitForStableTransfer(page, transfer!);

    if (iteration >= 5) {
      const sampleRecords = [...records];
      samples.push({
        elapsedMs: performance.now() - started,
        requestBytes: response.request().postDataBuffer()?.length ?? 0,
        responseBytes: transfer!.responseBodyBytes,
        responseTransferBytes: transfer!.responseTransferBytes,
        records: sampleRecords,
        unrelatedPrefetch: unrelatedPrefetch(sampleRecords)
      });
    }
  }

  write(`save-transport-${phase}.json`, {
    load: { records: loadRecords, unrelatedPrefetch: loadUnrelated },
    samples
  });

  expect(loadUnrelated).toEqual([]);
  expect(samples).toHaveLength(30);
  expect(samples.every((sample) => sample.unrelatedPrefetch.length === 0)).toBe(true);
  expect(samples.every((sample) => sample.responseBytes > 0)).toBe(true);

  const updatedTitle = `Audit mixed 40 — ${phase}`;
  await page.getByRole("button", { name: "Drawing Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Drawing Settings" });
  await settings.getByLabel("Title").fill(updatedTitle);
  await settings.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drawing saved" })).toBeVisible();

  await page.getByRole("link", { name: "Drawings", exact: true }).click();
  await expect(page).toHaveURL(/\/drawings$/);
  await expect(page.getByRole("link", { name: updatedTitle })).toBeVisible();
  await page.getByRole("link", { name: updatedTitle }).click();
  await ready(page);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await cdp.detach();
});
