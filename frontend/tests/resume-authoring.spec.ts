import { test, expect, type Page } from "@playwright/test";
const PASSWORD = "authoring-test-password-2026";
async function fixture(page: Page) {
  await page.goto("/workspace");
  const origin = new URL(page.url()).origin;
  const email = `authoring-${crypto.randomUUID()}@example.com`;
  const registration = await page.request.post("/api/account:register", {
    headers: { Origin: origin },
    data: { email, password: PASSWORD, displayName: "制作验收" },
  });
  expect(registration.ok()).toBeTruthy();
  const owner = (await registration.json()).id;
  const response = await page.request.post("/api/cvs", {
    headers: { Origin: origin },
    data: {
      displayName: "制作验收简历",
      sections: [
        {
          id: "summary",
          type: "summary",
          title: "个人简介",
          visible: true,
          content: null,
          items: [],
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  const cv = await response.json();
  await page.goto(`/cvs/${cv.id}`);
  await expect(page.getByLabel("姓名", { exact: true })).toBeVisible();
  return { cv, owner, email, origin };
}
async function isSaved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "已保存" }),
  ).toBeVisible();
}
test("autosave serializes edits and save-and-return waits for input typed during a request", async ({
  page,
}) => {
  const { cv } = await fixture(page);
  let release!: () => void;
  let arrived!: () => void;
  const started = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route(`**/api/cvs/${cv.id}`, async (route) => {
    if (route.request().method() === "PATCH" && ++requests === 1) {
      arrived();
      await gate;
    }
    await route.continue();
  });
  await page.getByLabel("姓名", { exact: true }).fill("第一版输入");
  await started;
  await page.getByLabel("姓名", { exact: true }).fill("请求期间的最新中文输入");
  await page.getByRole("button", { name: "返回我的简历" }).click();
  await page.getByRole("button", { name: "保存并返回" }).click();
  release();
  await expect(page).toHaveURL(/\/$/);
  const saved = await (await page.request.get(`/api/cvs/${cv.id}`)).json();
  expect(saved.profile.fullName).toBe("请求期间的最新中文输入");
  expect(requests).toBe(2);
});
test("Chinese composition postpones autosave until composition ends", async ({
  page,
}) => {
  const { cv } = await fixture(page);
  let requests = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().endsWith(cv.id))
      requests++;
  });
  const name = page.getByLabel("姓名", { exact: true });
  await name.dispatchEvent("compositionstart");
  await name.fill("正在组合的中文");
  await page.waitForTimeout(1600);
  expect(requests).toBe(0);
  await name.dispatchEvent("compositionend");
  await expect.poll(() => requests).toBe(1);
  await isSaved(page);
});
test("Markdown persists supported semantics and protects incompatible source across reload", async ({
  page,
}) => {
  const { cv } = await fixture(page);
  await page.getByLabel("姓名", { exact: true }).fill("字段不变");
  await page
    .getByRole("navigation", { name: "简历模块" })
    .getByRole("button", { name: "个人简介", exact: true })
    .click();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Markdown 正文" });
  await input.fill(
    "**成果** 与 `代码` [项目](https://example.com)\n\n- 第一项\n  - 嵌套项目",
  );
  await isSaved(page);
  await page.getByRole("tab", { name: "富文本", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "经历正文" }).locator("strong"),
  ).toHaveText("成果");
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await expect(input).toHaveValue(/成果/);
  await input.fill("# 未支持标题\n<script>window.BAD=1</script>");
  await page.getByRole("tab", { name: "富文本", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "正文含有不兼容格式" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消切换" }).click();
  await expect(input).toHaveValue(
    "# 未支持标题\n<script>window.BAD=1</script>",
  );
  await page.reload();
  await page.getByRole("button", { name: "恢复继续编辑" }).click();
  await page
    .getByRole("navigation", { name: "简历模块" })
    .getByRole("button", { name: "个人简介", exact: true })
    .click();
  await expect(input).toHaveValue(
    "# 未支持标题\n<script>window.BAD=1</script>",
  );
  await page.getByRole("tab", { name: "富文本", exact: true }).click();
  await page.getByRole("button", { name: "转为纯文本" }).click();
  await isSaved(page);
  await page.reload();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue(
    "字段不变",
  );
  const saved = await (await page.request.get(`/api/cvs/${cv.id}`)).json();
  expect(JSON.stringify(saved.sections[0].content)).toContain("未支持标题");
  expect(await page.evaluate(() => "BAD" in window)).toBe(false);
});
test("failed save survives reload; stale recovery only permits a separate copy", async ({
  page,
}) => {
  const { cv, origin } = await fixture(page);
  await page.route(`**/api/cvs/${cv.id}`, (route) =>
    route.request().method() === "PATCH" ? route.abort() : route.continue(),
  );
  await page.getByLabel("姓名", { exact: true }).fill("故障后的本机草稿");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "保留" }),
  ).toBeVisible();
  await page.unroute(`**/api/cvs/${cv.id}`);
  const update = await page.request.patch(`/api/cvs/${cv.id}`, {
    headers: { Origin: origin },
    data: {
      displayName: "远端的新版本",
      etag: cv.etag,
      updateMask: "displayName",
    },
  });
  expect(update.ok()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "恢复继续编辑" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "恢复为副本" }).click();
  await expect(page).not.toHaveURL(new RegExp(cv.id));
  await page.getByRole("button", { name: "恢复继续编辑" }).click();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue(
    "故障后的本机草稿",
  );
  expect(
    (await (await page.request.get(`/api/cvs/${cv.id}`)).json()).displayName,
  ).toBe("远端的新版本");
});
test("unapplied entry fields and Markdown are recoverable without inserting a blank entry", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("button", { name: "管理模块" }).click();
  await page.getByRole("button", { name: /添加工作经历/ }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "工作经历", exact: true }).click();
  await page.getByRole("button", { name: "添加工作经历", exact: true }).click();
  await page.getByLabel("公司", { exact: true }).fill("尚未应用的公司");
  await page.reload();
  await page.getByRole("button", { name: "恢复继续编辑" }).click();
  await expect(page.getByLabel("公司", { exact: true })).toHaveValue(
    "尚未应用的公司",
  );
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a different signed-in account cannot see or save another owner's recovery", async ({
  page,
}) => {
  const { cv, origin, email } = await fixture(page);
  await page.getByLabel("姓名", { exact: true }).fill("原账户私有草稿");
  const second = await page.request.post("/api/account:register", {
    headers: { Origin: origin },
    data: {
      displayName: "另一个账户",
      email: `second-${crypto.randomUUID()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(second.ok()).toBeTruthy();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByText("账户已切换，请用原账户登录后重开。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "发现本机未保存草稿" }),
  ).toHaveCount(0);
  expect((await page.request.get(`/api/cvs/${cv.id}`)).status()).toBe(404);
  await page.request.post("/api/account:login", {
    headers: { Origin: origin },
    data: { email, password: PASSWORD },
  });
  await page.reload();
  await page.getByRole("button", { name: "恢复继续编辑" }).click();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue(
    "原账户私有草稿",
  );
});

test("storage failure keeps memory input and manual retry; mobile Markdown has no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Disabled", "QuotaExceededError");
    };
  });
  await page.getByLabel("姓名", { exact: true }).fill("存储不可用仍保留");
  await expect(page.getByText(/本机恢复存储不可用/)).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await isSaved(page);
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue(
    "存储不可用仍保留",
  );
  await page
    .getByRole("navigation", { name: "简历模块" })
    .getByRole("button", { name: "个人简介", exact: true })
    .click();
  await page.getByRole("tab", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown 正文")
    .fill("**手机制作** 与 `TypeScript`\n\n- 真实内容");
  await isSaved(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("explicit logout clears recovery in all open editor tabs", async ({
  page,
  context,
}) => {
  const { owner } = await fixture(page);
  await page.getByLabel("姓名", { exact: true }).fill("退出前的私有草稿");
  const workspace = await context.newPage();
  await workspace.goto("/workspace");
  await workspace.getByRole("button", { name: "打开账户菜单" }).click();
  await workspace.getByRole("menuitem", { name: "退出登录" }).click();
  await workspace
    .getByRole("dialog")
    .getByRole("button", { name: "退出登录", exact: true })
    .click();
  await expect(page.getByText(/当前账户已退出/)).toBeVisible();
  expect(
    await workspace.evaluate(
      (owner) =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith(`cvory:recovery:${encodeURIComponent(owner)}:`),
        ),
      owner,
    ),
  ).toEqual([]);
});

test("switching accounts after client verification still cannot create a private draft copy", async ({
  page,
}) => {
  const { cv, owner, origin } = await fixture(page);
  await page.route(`**/api/cvs/${cv.id}`, (route) =>
    route.request().method() === "PATCH" ? route.abort() : route.continue(),
  );
  await page
    .getByLabel("姓名", { exact: true })
    .fill("禁止跨账户复制的私有文字");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "保留" }),
  ).toBeVisible();
  await page.unroute(`**/api/cvs/${cv.id}`);
  await page.reload();
  let release!: () => void;
  let arrived!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route("**/api/account", async (route) => {
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "恢复为副本" }).click();
  await started;
  const second = await page.request.post("/api/account:register", {
    headers: { Origin: origin },
    data: {
      displayName: "切换后的账户",
      email: `race-${crypto.randomUUID()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(second.ok()).toBeTruthy();
  const rejected = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/cvs"),
  );
  release();
  const response = await rejected;
  expect(response.status()).toBe(403);
  expect(response.request().headers()["x-cvory-owner"]).toBe(owner);
  expect((await response.json()).error.details[0].reason).toBe(
    "ACCOUNT_CHANGED",
  );
  const list = await (await page.request.get("/api/cvs")).json();
  expect(list.cvs).toEqual([]);
  await expect(
    page.getByRole("dialog", { name: "发现本机未保存草稿" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) =>
        key.startsWith("cvory:recovery:"),
      ),
    ),
  ).toBe(true);
});

test("unsupported web paste becomes readable text and keyboard link editing stays accessible", async ({
  page,
}) => {
  const { cv } = await fixture(page);
  await page
    .getByRole("navigation", { name: "简历模块" })
    .getByRole("button", { name: "个人简介", exact: true })
    .click();
  const body = page.getByRole("textbox", { name: "经历正文" });
  await body.focus();
  await body.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "粘贴后保留的文字");
    clipboardData.setData(
      "text/html",
      '<h1 style="color:red" onclick="window.BAD=1">粘贴后保留的文字</h1><script>window.BAD=1</script>',
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(body).toContainText("粘贴后保留的文字");
  await expect(page.getByText(/已仅保留可读文字/)).toBeVisible();
  expect(await page.evaluate(() => "BAD" in window)).toBe(false);
  await body.press("ControlOrMeta+k");
  await expect(
    page.getByRole("dialog", { name: "编辑文字链接" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await isSaved(page);
  const value = await (await page.request.get(`/api/cvs/${cv.id}`)).json();
  expect(JSON.stringify(value.sections[0].content)).not.toContain("onclick");
  expect(JSON.stringify(value.sections[0].content)).not.toContain("style");
});
