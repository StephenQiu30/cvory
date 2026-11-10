import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
const PASSWORD = "workflow-test-password-2026";
async function signup(page: Page) {
  await page.goto("/workspace");
  await page.getByRole("button", { name: "登录或注册" }).click();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page.getByLabel("显示名称").fill("流程验收");
  const email = `workflow-${crypto.randomUUID()}@example.com`;
  await page.getByLabel("邮箱", { exact: false }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return email;
}
async function create(page: Page) {
  await page.getByRole("button", { name: "新建简历", exact: true }).click();
  await page.getByLabel("简历名称").fill("PRIVATE_SOURCE_SENTINEL");
  await page.getByRole("button", { name: "创建并编辑" }).click();
  await page.waitForURL("**/cvs/**");
  return page.url().split("/").pop()!;
}
async function entry(
  page: Page,
  module: string,
  title: string,
  subtitle?: string,
) {
  await page.getByRole("button", { name: module, exact: true }).click();
  await page
    .getByRole("button", { name: `添加${module}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#entry-title").fill(title);
  if (subtitle) await dialog.locator("#entry-subtitle").fill(subtitle);
  if (module !== "专业技能") {
    await dialog.getByLabel("开始月份").fill("2022-09");
    await dialog.getByLabel("结束月份").fill("2026-06");
  }
  if (module === "教育经历")
    await dialog.getByLabel("学历", { exact: true }).fill("本科");
  await dialog
    .getByRole("textbox", { name: "经历正文" })
    .fill(`${title}：内容与成果，保留真实填写值。`);
  await dialog.getByRole("button", { name: "添加到简历" }).click();
  await expect(dialog).toHaveCount(0);
}
async function save(page: Page) {
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存" }),
  ).toBeVisible();
}

async function verifyTestAccount(page: Page, email: string) {
  const pattern = "**/api/account/github/link?**";
  await page.route(pattern, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    expect(response.status()).toBe(303);
    const authorization = new URL(response.headers().location);
    expect(authorization.origin).toBe("https://github.com");
    const target = new URL(
      `/api/account/github/callback?state=${authorization.searchParams.get("state")}&code=${encodeURIComponent(email)}`,
      page.url(),
    );
    await route.fulfill({
      response,
      headers: { ...response.headers(), location: target.toString() },
    });
  });
  await page.goto("/settings/github");
  await page.getByRole("button", { name: "授权并绑定 GitHub" }).click();
  await expect(
    page.getByText("已连接 @cvory-fixture", { exact: true }),
  ).toBeVisible();
  await page.unroute(pattern);
  await page.goto("/workspace");
}

test("register → blank CV → four modules → save/reopen → templates → frozen public result", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = await signup(page);
  await verifyTestAccount(page, email);
  const id = await create(page);
  await page.getByLabel("姓名", { exact: true }).fill("陈予安");
  await page.getByLabel("求职职位", { exact: true }).fill("前端工程师");
  await page
    .getByLabel("邮箱", { exact: true })
    .fill("PRIVATE_EMAIL@example.com");
  await page.getByLabel("电话", { exact: true }).fill("PRIVATE_PHONE");
  await entry(page, "教育经历", "华东理工大学", "软件工程");
  await entry(page, "工作经历", "序言科技", "全栈工程师");
  await entry(page, "项目经历", "简历制作工具", "核心开发");
  await entry(page, "专业技能", "前端开发");
  await save(page);
  let saved = await (await page.request.get(`/api/cvs/${id}`)).json();
  expect(
    saved.sections.find((s: { type: string }) => s.type === "education")
      .items[0].degree,
  ).toBe("本科");
  await page.reload();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue("陈予安");
  await page.getByRole("button", { name: "调整样式" }).click();
  await page.getByRole("button", { name: /时间索引/ }).click();
  await page.getByRole("button", { name: "深蓝", exact: true }).click();
  await page.getByRole("button", { name: "应用样式", exact: true }).click();
  await save(page);
  saved = await (await page.request.get(`/api/cvs/${id}`)).json();
  expect(saved.styleSettings.templateId).toBe("timeline");
  expect(saved.styleSettings.accent).toBe("blue");
  await page.goto("/settings/publication");
  await page.getByRole("switch", { name: "电子邮箱" }).uncheck();
  await page.getByRole("button", { name: "预览公开内容" }).click();
  await expect(page.getByText("本次公开预览", { exact: true })).toBeVisible();
  await expect(
    page.getByText("PRIVATE_EMAIL@example.com", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "确认发布", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认发布", exact: true })
    .click();
  await expect(page.getByText("公开内容已更新")).toBeVisible();
  const me = await (await page.request.get("/api/account")).json();
  const anonymous = await context.browser()!.newContext();
  const visitor = await anonymous.newPage();
  await visitor.goto(`/u/${me.publicId}`);
  await expect(
    visitor.getByRole("heading", { name: "陈予安", exact: true }),
  ).toBeVisible();
  const html = await visitor.content();
  expect(html).not.toContain("PRIVATE_EMAIL");
  expect(html).not.toContain("PRIVATE_PHONE");
  expect(html).not.toContain("PRIVATE_SOURCE_SENTINEL");
  await page.getByRole("button", { name: "撤回公开内容" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认撤回" })
    .click();
  await expect(page.getByText("公开内容已撤回")).toBeVisible();
  await visitor.reload();
  await expect(
    visitor.getByRole("heading", { name: "这份简历暂未公开" }),
  ).toBeVisible();
  await anonymous.close();
  expect(errors).toEqual([]);
});

test("save response preserves edits made during the request", async ({
  page,
}) => {
  await signup(page);
  const id = await create(page);
  await page.getByLabel("姓名", { exact: true }).fill("第一次输入");
  let release: () => void = () => {};
  let intercepted: () => void = () => {};
  const arrived = new Promise<void>((r) => (intercepted = r));
  const gate = new Promise<void>((r) => (release = r));
  await page.route(`**/api/cvs/${id}`, async (route) => {
    if (route.request().method() === "PATCH") {
      intercepted();
      await gate;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await arrived;
  await page.getByLabel("姓名", { exact: true }).fill("保存期间继续输入");
  release();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存" }),
  ).toBeVisible();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue(
    "保存期间继续输入",
  );
  await page.unroute(`**/api/cvs/${id}`);
  await save(page);
  expect(
    (await (await page.request.get(`/api/cvs/${id}`)).json()).profile.fullName,
  ).toBe("保存期间继续输入");
});

test("mobile preserves module context and has no horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page);
  await create(page);
  await page.getByLabel("姓名", { exact: true }).fill("移动端用户");
  await entry(page, "教育经历", "移动端大学", "软件工程");
  await page.getByRole("button", { name: "预览简历", exact: true }).click();
  await expect(page.locator("[data-resume-document]").first()).toContainText(
    "移动端大学",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "填写信息", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "添加教育经历", exact: true }),
  ).toBeVisible();
  await save(page);
});

test("JSON export/import restores source data and PDF is an actual file", async ({
  page,
}) => {
  await signup(page);
  const id = await create(page);
  await page.getByLabel("姓名", { exact: true }).fill("文件验收");
  await entry(page, "工作经历", "文件公司", "工程师");
  await save(page);
  await page.getByRole("button", { name: "导出简历" }).click();
  await page.getByRole("radio", { name: /JSON/ }).check();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "生成并下载" }).click();
  const backup = await waiting;
  const file = await backup.path();
  expect(file).toBeTruthy();
  await page.getByRole("button", { name: "返回编辑" }).click();
  await page.goto("/workspace");
  await page.getByRole("button", { name: "导入", exact: true }).click();
  await page.getByLabel("选择简历文件").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: await readFile(file!),
  });
  await page.getByRole("button", { name: "确认并新建" }).click();
  await page.waitForURL("**/cvs/**");
  expect(page.url()).not.toContain(id);
  await page.getByRole("button", { name: "导出简历" }).click();
  const pdfWaiting = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: "生成并下载" }).click();
  const pdf = await pdfWaiting;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  const fs = await import("node:fs/promises");
  expect(
    (await fs.readFile((await pdf.path())!)).subarray(0, 4).toString(),
  ).toBe("%PDF");
});

test("portrait and account avatar remain independent; cancel keeps crop", async ({
  page,
}) => {
  await signup(page);
  const id = await create(page);
  await page.getByLabel("姓名", { exact: true }).fill("照片用户");
  await page.getByRole("button", { name: "选择照片", exact: true }).click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByLabel("选择图片文件").setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByAltText("待应用的照片预览")).toBeVisible();
  await page.getByRole("button", { name: "应用照片" }).click();
  await save(page);
  const before = await (await page.request.get(`/api/cvs/${id}`)).json();
  expect(before.profile.avatarUrl).toMatch(/^data:image\/jpeg/);
  await page.getByRole("button", { name: "更换／调整照片" }).click();
  await page.getByRole("slider", { name: "水平位置" }).focus();
  await page.getByRole("slider", { name: "水平位置" }).press("End");
  await expect(page.getByRole("slider", { name: "水平位置" })).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await save(page);
  expect(
    (await (await page.request.get(`/api/cvs/${id}`)).json()).profile.photoX,
  ).toBe(before.profile.photoX);
  await page.goto("/settings/profile");
  await page.getByRole("button", { name: "选择照片", exact: true }).click();
  await page
    .getByLabel("选择图片文件")
    .setInputFiles({ name: "account.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "应用照片" }).click();
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("资料已保存", { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get(`/api/cvs/${id}`)).json()).profile.avatarUrl,
  ).toBe(before.profile.avatarUrl);
});

test("design tokens, dialogs and theme work on desktop and mobile", async ({
  page,
}) => {
  await signup(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/workspace");
    await page.evaluate(() => {
      localStorage.setItem("cvory.theme.v1", "light");
      document.documentElement.classList.remove("dark");
    });
    const create = page.getByRole("button", { name: "新建简历", exact: true });
    await expect(create).toBeVisible();
    await expect(create).toHaveCSS("border-radius", "6px");
    await expect(create).toHaveCSS("border-top-width", "0px");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(250, 250, 250)",
    );
    const primary = page.getByRole("button", { name: "立即创建", exact: true });
    await expect(primary).toHaveCSS("background-color", "rgb(23, 23, 23)");
    await expect(primary).toHaveCSS("border-radius", "6px");
    await expect(page.locator(".workspace-shell")).toHaveCSS(
      "background-image",
      "none",
    );
    const libraryTabs = page.getByRole("tablist", { name: "简历列表" });
    const privateTab = libraryTabs.getByRole("tab", { name: "我的简历" });
    await expect(privateTab).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    expect(
      await privateTab.evaluate(
        (node) => getComputedStyle(node, "::after").content,
      ),
    ).toBe("none");
    const activeNavigation = page.locator(
      '[data-slot="navigation-menu-link"][data-active]',
    );
    await expect(activeNavigation).toHaveCSS("border-bottom-width", "0px");
    expect(
      await activeNavigation.evaluate(
        (node) => getComputedStyle(node, "::after").content,
      ),
    ).toBe("none");
    await privateTab.focus();
    await page.keyboard.press("ArrowRight");
    const publicTab = libraryTabs.getByRole("tab", { name: "公开简历" });
    await expect(publicTab).toBeFocused();
    await expect(publicTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(privateTab).toBeFocused();
    await expect(privateTab).toHaveAttribute("aria-selected", "true");
    await create.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("border-radius", "6px");
    await expect(dialog).toHaveCSS("border-top-width", "0px");
    await expect(page.getByLabel("简历名称")).toHaveCSS(
      "border-top-width",
      "0px",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "切换外观" }).click();
    await page.getByRole("menuitemradio", { name: "深色" }).click();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(23, 23, 23)",
    );
    await expect(create).toHaveCSS("background-color", "rgb(48, 48, 48)");
    await expect(primary).toHaveCSS("background-color", "rgb(250, 250, 250)");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});

test("authentication modal keeps context and preserves drafts after session expiry", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace");
  const trigger = page.getByRole("button", { name: "登录或注册" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "欢迎回来" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const email = await signup(page);
  await create(page);
  await page.getByLabel("姓名", { exact: true }).fill("保留的草稿");
  await context.clearCookies();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText(/登录已过期|会话已过期/)).toBeVisible();
  await page.getByRole("button", { name: "重新登录" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("邮箱", { exact: false })
    .fill(email);
  await page
    .getByRole("dialog")
    .getByLabel("密码", { exact: true })
    .fill(PASSWORD);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "登录", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue(
    "保留的草稿",
  );
  await save(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("login from settings keeps the current page", async ({ page }) => {
  await page.goto("/settings/appearance");
  await page.getByRole("button", { name: "登录账户" }).click();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page
    .getByLabel("邮箱", { exact: false })
    .fill(`settings-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("密码", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  await expect(page.getByText("管理界面主题")).toBeVisible();
});

test("Tiptap formatting keeps the entry open and persists JSON marks", async ({
  page,
}) => {
  await signup(page);
  const id = await create(page);
  await page.getByRole("button", { name: "工作经历", exact: true }).click();
  await page.getByRole("button", { name: "添加工作经历", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#entry-title").fill("Tiptap 验收");
  await dialog.locator("#entry-subtitle").fill("工程师");
  await dialog.getByLabel("开始月份").fill("2022-09");
  await dialog.getByLabel("结束月份").fill("2026-06");
  const editor = dialog.getByRole("textbox", { name: "经历正文" });
  await editor.fill("格式保留");
  await editor.press("ControlOrMeta+a");
  await dialog.getByRole("button", { name: "加粗", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(editor.locator("strong")).toHaveText("格式保留");
  await dialog.getByRole("button", { name: "添加到简历" }).click();
  await save(page);
  const cv = await (await page.request.get(`/api/cvs/${id}`)).json();
  const description = cv.sections.find(
    (section: { type: string }) => section.type === "experience",
  ).items[0].description;
  expect(description.type).toBe("doc");
  expect(JSON.stringify(description)).toContain('"type":"bold"');
  await page.reload();
  await expect(
    page.locator(".resume-document strong").filter({ hasText: "格式保留" }),
  ).toBeVisible();
});
