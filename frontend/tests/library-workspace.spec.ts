import { expect, test, type Page } from "@playwright/test";

async function signup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "登录或注册", exact: true }).click();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page.getByLabel("显示名称").fill("工作台验收");
  await page
    .getByLabel("邮箱")
    .fill(`library-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("密码", { exact: true }).fill("library-test-password");
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "新建简历", exact: true }),
  ).toBeVisible();
}

async function readCv(page: Page, id: string): Promise<API.CVResource> {
  const response = await page.request.get(`/api/cvs/${id}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth + 1));
}

test("template creation stays blank; rename persists; copies are independent; cancelled deletion keeps data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/cannot contain|cannot be.*descendant/.test(message.text()))
      errors.push(message.text());
  });
  await signup(page);
  for (const name of ["标准单栏", "紧凑单栏", "时间索引"]) {
    await expect(
      page.getByRole("button", { name: `使用${name}`, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "使用紧凑单栏", exact: true }).click();
  const createDialog = page.getByRole("dialog");
  await expect(
    createDialog.getByRole("radio", { name: "紧凑单栏", exact: true }),
  ).toBeChecked();
  await createDialog.getByLabel("简历名称").fill("工作台原件");
  await createDialog.getByRole("button", { name: "创建并编辑" }).click();
  await page.waitForURL("**/cvs/**");
  const sourceId = page.url().split("/").pop()!;
  const source = await readCv(page, sourceId);
  expect(source.styleSettings.templateId).toBe("compact");
  expect(source.profile.fullName).toBe("");
  expect(
    source.sections.every(
      (section) => !section.content && !section.items?.length,
    ),
  ).toBe(true);
  expect(JSON.stringify(source)).not.toContain("林知夏");
  expect(JSON.stringify(source)).not.toContain("示例科技");

  await page.goto("/");
  await page
    .getByRole("button", { name: "修改工作台原件的名称", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("简历名称").fill("工作台重命名");
  await page.getByRole("button", { name: "保存名称", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "复制工作台重命名", exact: true }),
  ).toBeVisible();
  expect((await readCv(page, sourceId)).displayName).toBe("工作台重命名");

  await page
    .getByRole("button", { name: "复制工作台重命名", exact: true })
    .click();
  await page.waitForURL("**/cvs/**");
  const copyId = page.url().split("/").pop()!;
  expect(copyId).not.toBe(sourceId);
  const copy = await readCv(page, copyId);
  expect(copy.sections).toEqual(source.sections);
  expect(copy.styleSettings).toEqual(source.styleSettings);
  await page.getByLabel("姓名", { exact: true }).fill("只修改副本");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存" }),
  ).toBeVisible();
  expect((await readCv(page, copyId)).profile.fullName).toBe("只修改副本");
  expect((await readCv(page, sourceId)).profile.fullName).toBe("");

  await page.goto("/");
  const deleteButton = page.getByRole("button", {
    name: "删除工作台重命名 · 副本",
    exact: true,
  });
  await deleteButton.click();
  await expect(page.getByRole("dialog")).toContainText("永久删除");
  await page.getByRole("button", { name: "保留", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(deleteButton).toBeFocused();
  expect((await readCv(page, copyId)).profile.fullName).toBe("只修改副本");
  const list = await (await page.request.get("/api/cvs")).json();
  expect(list.totalSize).toBe(2);
  expect(errors).toEqual([]);
});

test("mobile Markdown creation requires review and preserves content; template preview closes back to its trigger", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/cannot contain|cannot be.*descendant/.test(message.text()))
      errors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("tab", { name: "Markdown 简历", exact: true }).click();
  await page
    .getByRole("button", { name: "创建 Markdown 简历", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Markdown 正文")).toHaveValue("");
  await dialog
    .getByLabel("Markdown 正文")
    .fill(
      "# 叶清\n前端工程师\n\n## 项目经历\n- 完成 **工作台交付** 与键盘交互验证\n- 文档支持 [项目链接](https://example.com)",
    );
  await dialog
    .getByRole("button", { name: "校对 Markdown", exact: true })
    .click();
  await expect(dialog).toContainText("校对导入内容");
  await expect(dialog.getByLabel("姓名", { exact: true })).toHaveValue("叶清");
  expect((await (await page.request.get("/api/cvs")).json()).totalSize).toBe(0);
  await dialog.getByLabel("简历名称").fill("Markdown 校对结果");
  await dialog.getByRole("button", { name: "确认并新建", exact: true }).click();
  await page.waitForURL("**/cvs/**");
  const document = await readCv(page, page.url().split("/").pop()!);
  expect(document.displayName).toBe("Markdown 校对结果");
  expect(document.profile.fullName).toBe("叶清");
  const content = JSON.stringify(
    document.sections.find((section) => section.title === "项目经历")?.content,
  );
  expect(content).toContain("工作台交付");
  expect(content).toContain('"type":"bold"');
  expect(content).toContain("https://example.com");

  await page.goto("/");
  await expect(page.locator("a a")).toHaveCount(0);
  const preview = page.getByRole("button", {
    name: "查看标准单栏预览",
    exact: true,
  });
  await preview.click();
  await expect(page.getByRole("dialog")).toContainText(
    "合成示例仅用于展示版式",
  );
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(preview).toBeFocused();
  await page
    .getByRole("button", { name: "使用时间索引", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "使用时间索引", exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
