import { expect, test, type Locator } from "@playwright/test";

async function expectTrailingIcon(input: Locator) {
  const layout = await input.evaluate(node => {
    const icon = node.parentElement!.querySelector("svg")!;
    const box = node.getBoundingClientRect(); const iconBox = icon.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      textRight: box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth),
      iconLeft: iconBox.left, iconRight: iconBox.right, inputRight: box.right,
      iconCenterY: iconBox.y + iconBox.height / 2, inputCenterY: box.y + box.height / 2,
      pointerEvents: getComputedStyle(icon).pointerEvents, paddingLeft: parseFloat(style.paddingLeft),
      width: box.width, wrapperWidth: node.parentElement!.getBoundingClientRect().width
    };
  });
  expect(layout.textRight + 8).toBeLessThanOrEqual(layout.iconLeft);
  expect(layout.iconRight).toBeLessThan(layout.inputRight);
  expect(Math.abs(layout.iconCenterY - layout.inputCenterY)).toBeLessThan(1);
  expect(layout.paddingLeft).toBeLessThanOrEqual(10);
  expect(layout.pointerEvents).toBe("none");
  expect(layout.width).toBeLessThanOrEqual(layout.wrapperWidth + 1);
}

// Read-only: works against either a guarded synthetic preview or the live library.
for (const width of [360, 768, 1440]) {
  test(`search icon and text stay separate at ${width}px, including compact controls`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/bom/items");
    const input = page.getByLabel("Search", { exact: true });
    await expect(input).toBeVisible(); await expectTrailingIcon(input);
    await input.fill("Long part description and manufacturer ".repeat(3));
    await expectTrailingIcon(input);
    const icon = input.locator("..").locator("svg");
    const box = (await icon.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("name", "q");
    await expect(input).toHaveAttribute("maxlength", "120");
    await page.screenshot({ path: test.info().outputPath(`library-search-${width}.png`) });

    // Reuse the actual component markup and served stylesheet to exercise the
    // compact override in a separate static page, never inside React-managed DOM.
    const fixtureData = await input.evaluate(node => ({
      markup: node.parentElement!.outerHTML,
      styles: [...document.styleSheets].map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join("\n")),
      bodyClass: document.body.className
    }));
    const fixture = await page.context().newPage();
    await fixture.setViewportSize({ width, height: 900 });
    await fixture.setContent('<html><head></head><body><section class="engineering-dialog-compact" style="margin:16px"></section></body></html>');
    await fixture.evaluate(data => {
      document.body.className = data.bodyClass;
      document.querySelector("section")!.innerHTML = data.markup;
      const control = document.querySelector("input")!;
      control.type = "search"; control.setAttribute("aria-label", "Compact search check");
      for (const css of data.styles) {
        const style = document.createElement("style"); style.textContent = css; document.head.append(style);
      }
    }, fixtureData);
    const compact = fixture.getByLabel("Compact search check");
    await expectTrailingIcon(compact); await compact.fill("Long compact query ".repeat(5)); await expectTrailingIcon(compact);
    await expect(compact).toHaveCSS("font-size", "12px");
    await fixture.screenshot({ path: test.info().outputPath(`compact-search-${width}.png`) });
    await fixture.close();
    expect(errors).toEqual([]);
  });
}
