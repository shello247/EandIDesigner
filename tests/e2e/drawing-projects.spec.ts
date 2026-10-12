import { prisma } from "../../src/lib/prisma";
import { parseDrawingModelJson } from "../../src/features/drawing_canvas/data/schema";
import { expect, test } from "./drawing-test";

test.describe.configure({ mode: "serial" });

test("organizes drawings in Projects without coupling membership to printed fields", async ({
  page,
  request
}) => {
  test.setTimeout(120000);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const firstProjectName = `E2E Tank Automation ${suffix}`;
  const secondProjectName = `E2E Upgrade Project ${suffix}`;
  const firstClientName = `E2E Client A ${suffix}`;
  const secondClientName = `E2E Client B ${suffix}`;
  const drawingTitle = `E2E Project Drawing ${suffix}`;
  const secondNumber = `E2E-B-${suffix}`;

  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "New Project" }).click();
  await expect(page.getByLabel("Project number")).toHaveCount(0);
  await expect(page.getByText(/Project number will be generated automatically/)).toBeVisible();
  await page.getByLabel("Project name").fill(firstProjectName);
  await page.getByRole("button", { name: "Add Client" }).click();
  const addClientDialog = page.getByRole("dialog", { name: "Add Client" });
  await addClientDialog.getByLabel("Client name").fill(firstClientName);
  await addClientDialog
    .getByRole("button", { name: "Add Client", exact: true })
    .click();
  await expect(addClientDialog).toHaveCount(0);
  await expect(page.getByLabel(/^Client/)).toHaveValue(/.+/);
  await expect(page.getByLabel(/^Client/).locator("option:checked")).toHaveText(
    firstClientName
  );
  await page.getByLabel("Description").fill("Project created by the drawing Projects workflow.");
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/?]+$/);
  await expect(page.getByRole("heading", { name: firstProjectName })).toBeVisible();

  const firstProject = await prisma.project.findFirstOrThrow({
    where: { name: firstProjectName }
  });
  expect(firstProject.projectNumber).toMatch(/^PRJ-\d{6,}$/);
  const firstClient = await prisma.client.findUniqueOrThrow({
    where: { id: firstProject.clientId! }
  });
  expect(firstClient.name).toBe(firstClientName);
  const secondClient = await prisma.client.create({
    data: {
      name: secondClientName,
      normalizedName: secondClientName.toLocaleLowerCase("en-US")
    }
  });
  const secondProject = await prisma.project.create({
    data: {
      name: secondProjectName,
      projectNumber: secondNumber,
      normalizedProjectNumber: secondNumber.toLowerCase(),
      clientId: secondClient.id,
      client: secondClientName,
      status: "active"
    }
  });

  await page.getByRole("link", { name: "New drawing for this Project" }).click();
  await expect(page).toHaveURL(/\/drawings\/new\?projectId=/);
  await expect(page.getByLabel("Drawing key")).toHaveCount(0);
  await expect(page.getByRole("link", { name: `${firstProject.projectNumber} — ${firstProjectName}`, exact: true }))
    .toHaveAttribute("href", `/projects/${firstProject.id}`);
  await expect(page.getByRole("combobox", { name: /^Project/ })).toHaveCount(0);
  await page.getByLabel("Title").fill(drawingTitle);
  await page
    .getByRole("textbox", { name: /^Description/ })
    .fill("Detailed controls drawing organized under a Project.");
  await page.getByRole("button", { name: "Create blank drawing" }).click();
  await expect(page).toHaveURL(/\/drawings\/[^/?]+$/);
  const drawingId = page.url().split("/").filter(Boolean).at(-1)!;

  let stored = await prisma.drawing.findUniqueOrThrow({
    where: { id: drawingId }
  });
  expect(stored.drawingKey).toMatch(/^e2e_project_drawing_/);
  expect(stored.projectId).toBe(firstProject.id);
  expect(stored.description).toBe(
    "Detailed controls drawing organized under a Project."
  );
  expect(parseDrawingModelJson(stored.modelJson).titleBlock).toMatchObject({
    project: firstProjectName,
    client: firstClientName
  });

  await page.goto("/drawings");
  const drawingRow = page.getByRole("row").filter({ hasText: drawingTitle });
  await expect(drawingRow).toContainText("Detailed controls drawing organized under a Project.");
  await expect(drawingRow).toContainText(firstProject.projectNumber!);
  await drawingRow.getByRole("link", { name: drawingTitle }).click();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();

  await page.getByRole("button", { name: "Drawing Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Drawing Settings" });
  await expect(settings.getByLabel("Linked Project")).toBeEnabled();
  await settings.getByLabel("Linked Project").selectOption(secondProject.id);
  await settings.getByLabel("Drawing description").fill("Reassigned drawing scope.");
  await settings.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  stored = await prisma.drawing.findUniqueOrThrow({ where: { id: drawingId } });
  expect(stored.projectId).toBe(secondProject.id);
  expect(stored.description).toBe("Reassigned drawing scope.");
  expect(parseDrawingModelJson(stored.modelJson).titleBlock).toMatchObject({
    project: firstProjectName,
    client: firstClientName
  });

  await page.reload();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await page.getByRole("button", { name: "Drawing Settings" }).click();
  await expect(settings.getByLabel("Linked Project")).toHaveValue(secondProject.id);
  await settings.getByLabel("Linked Project").selectOption("");
  await settings.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  stored = await prisma.drawing.findUniqueOrThrow({ where: { id: drawingId } });
  expect(stored.projectId).toBeNull();
  expect(stored.description).toBe("Reassigned drawing scope.");

  await page.reload();
  await expect(page.getByTestId("drawing-canvas-viewport")).toBeVisible();
  await page.getByRole("button", { name: "Drawing Settings" }).click();
  await expect(settings.getByLabel("Linked Project")).toHaveValue("");
  await settings.getByLabel("Linked Project").selectOption(secondProject.id);
  await settings.getByRole("tab", { name: "Printed Title Block" }).click();
  await settings
    .getByRole("button", {
      name: "Use project details"
    })
    .click();
  await settings.getByRole("button", { name: "Use these values" }).click();
  await settings.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Drawing saved.")).toBeVisible();

  stored = await prisma.drawing.findUniqueOrThrow({ where: { id: drawingId } });
  expect(parseDrawingModelJson(stored.modelJson).titleBlock).toMatchObject({
    project: secondProjectName,
    client: secondClientName
  });

  const printResponse = await request.get(`/drawings/${drawingId}/print`);
  expect(printResponse.ok()).toBe(true);
  expect(await printResponse.text()).toContain(secondProjectName);
  const pdfResponse = await request.get(`/drawings/${drawingId}/pdf`);
  expect(pdfResponse.ok()).toBe(true);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

  await page.goto(`/projects/${secondProject.id}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive Project" }).click();
  await expect(page.getByText("archived", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "New drawing for this Project" })).toHaveCount(0);

  await page.goto(`/drawings/new?projectId=${secondProject.id}`);
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("button", { name: "Create blank drawing" })).toHaveCount(0);
  await page.goto(`/drawings/${drawingId}`);
  await page.getByRole("button", { name: "Drawing Settings" }).click();
  await expect(settings.getByLabel("Linked Project")).toHaveValue(secondProject.id);
  await expect(settings.getByText("retains its archived Project")).toBeVisible();
  await settings.getByRole("button", { name: "Cancel" }).click();

  await page.goto(`/projects/${secondProject.id}`);
  await page.getByRole("button", { name: "Restore Project" }).click();
  await expect(page.getByText("active", { exact: true })).toBeVisible();
});
