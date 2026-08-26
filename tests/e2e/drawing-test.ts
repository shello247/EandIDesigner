import { expect, test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Locator, Page } from "@playwright/test";

// All maintained drawing workflows fail on unhandled errors, including popups.
// Keep the first messages bounded without dropping the total error count.
export const test = base.extend<{ drawingPageErrors: void }>({
  drawingPageErrors: [async ({ context }, runTest) => {
    const messages: string[] = [];
    let count = 0;
    const pages = new Set<Page>();
    const onError = (error: Error) => {
      count += 1;
      if (messages.length < 20) messages.push(error.message);
    };
    const onPage = (page: Page) => {
      pages.add(page);
      page.on("pageerror", onError);
    };
    context.pages().forEach(onPage);
    context.on("page", onPage);
    try {
      await runTest();
    } finally {
      context.off("page", onPage);
      pages.forEach((page) => page.off("pageerror", onError));
      expect(count, `Unhandled drawing page errors: ${JSON.stringify(messages)}`).toBe(0);
    }
  }, { auto: true }]
});
