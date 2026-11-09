import { expect, test, type Page } from "@playwright/test";

async function signup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "登录或注册", exact: true }).click();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page.getByLabel("显示名称").fill("状态验收");
  await page
    .getByLabel("邮箱")
    .fill(`status-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("密码", { exact: true }).fill("status-test-password");
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
const failure = {
  error: {
    code: 503,
    status: "UNAVAILABLE",
    message: "INTERNAL_DETAIL_MUST_STAY_PRIVATE",
  },
};

test("list failure retries through a loading state and recovers without showing server details", async ({
  page,
}) => {
  await signup(page);
  let attempt = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/cvs(?:\?|$)/, async (route) => {
    attempt++;
    if (attempt === 1) await route.fulfill({ status: 503, json: failure });
    else {
      await gate;
      await route.continue();
    }
  });
  await page.reload();
  const error = page.getByRole("main").getByRole("alert");
  await expect(error).toContainText("暂时无法连接服务");
  await expect(page.locator("body")).not.toContainText(failure.error.message);
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "正在加载简历" }),
  ).toBeVisible();
  await expect(error).toHaveCount(0);
  release();
  await expect(page.getByText("还没有简历", { exact: true })).toBeVisible();
});

test("failed profile save replaces success, preserves input and stays readable on a dark narrow screen", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/settings/profile");
  await page.getByLabel("显示名称").fill("已经保存的名称");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByRole("status")).toContainText("资料已保存");
  await page.route("**/api/account", async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({ status: 503, json: failure });
    else await route.continue();
  });
  await page.getByLabel("显示名称").fill("保留未保存输入");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "暂时无法连接服务",
  );
  await expect(page.getByText("资料已保存", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("显示名称")).toHaveValue("保留未保存输入");
  await expect(page.locator("body")).not.toContainText(failure.error.message);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "切换外观" }).click();
  await page.getByRole("menuitemradio", { name: "深色" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCSS(
    "color",
    "rgb(255, 136, 128)",
  );
  await expect(page.getByRole("main").getByRole("alert")).toHaveCSS(
    "background-color",
    "rgb(48, 48, 48)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("password validation and logout failures use the shared error presentation", async ({
  page,
}) => {
  await signup(page);
  await page.goto("/settings/access");
  await page
    .getByLabel("当前密码", { exact: true })
    .fill("status-test-password");
  await page.getByLabel("新密码", { exact: true }).fill("new-password-one");
  await page.getByLabel("确认新密码").fill("new-password-two");
  await page.getByRole("button", { name: "修改密码", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "两次输入的密码不一致。",
  );
  const style = await page
    .getByRole("main")
    .getByRole("alert")
    .evaluate((n) => ({
      font: getComputedStyle(n).fontSize,
      color: getComputedStyle(n).color,
    }));
  await page.goto("/");
  await page.route("**/api/account%3Alogout", (route) =>
    route.fulfill({ status: 503, json: failure }),
  );
  await page.getByRole("button", { name: "打开账户菜单" }).click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "退出登录", exact: true })
    .click();
  const error = page.getByRole("dialog").getByRole("alert");
  await expect(error).toContainText("暂时无法连接服务");
  await expect(error).toHaveCSS("font-size", style.font);
  await expect(error).toHaveCSS("color", style.color);
});

test("clipboard denial is an error with a manual copy recovery path", async ({
  page,
}) => {
  await signup(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    }),
  );
  await page.route("**/api/publication", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), published: true },
    });
  });
  await page.goto("/settings/publication");
  await page.getByRole("button", { name: "复制链接", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "复制失败",
  );
  await expect(page.getByLabel("公开网址")).toHaveValue(/\/u\//);
  await expect(page.getByText("网址输入框支持全选复制。")).toBeVisible();
});

test("not found, unpublished and unexpected server failures share the page status structure", async ({
  page,
}) => {
  await page.goto("/not-a-cvory-page");
  await expect(
    page.getByRole("heading", { name: "找不到这个页面" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回我的简历" }).click();
  await page.goto("/u/no-public-resume");
  await expect(
    page.getByRole("heading", { name: "这份简历暂未公开" }),
  ).toBeVisible();
  const unavailable = process.env.CV_TEST_UNAVAILABLE_URL;
  test.skip(
    !unavailable,
    "Requires a second isolated frontend pointing to an unavailable backend.",
  );
  await page.goto(`${unavailable}/u/no-public-resume`);
  await expect(
    page.getByRole("heading", { name: "暂时无法显示页面" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Unable to complete the request",
  );
});

test("preset rename failures stay inside the dialog and preserve the entered name", async ({
  page,
}) => {
  await signup(page);
  await page.getByRole("button", { name: "新建简历", exact: true }).click();
  await page.getByLabel("简历名称").fill("样式状态验收");
  await page.getByRole("button", { name: "创建并编辑" }).click();
  await page.waitForURL("**/cvs/**");
  await page.getByRole("button", { name: "调整样式" }).click();
  await page.getByLabel("保存为个人样式").fill("日常版式");
  await page.getByRole("button", { name: "保存样式", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "改名样式日常版式" }),
  ).toBeVisible();
  await page.route("**/api/presets", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({ status: 503, json: failure });
    else await route.continue();
  });
  await page.getByRole("button", { name: "改名样式日常版式" }).click();
  const dialog = page.getByRole("dialog", { name: "修改样式名称" });
  await dialog.getByLabel("样式名称").fill("保留的样式名称");
  await dialog.getByRole("button", { name: "保存名称" }).click();
  await expect(dialog.getByRole("alert")).toContainText("暂时无法连接服务");
  await expect(dialog.getByLabel("样式名称")).toHaveValue("保留的样式名称");
  await page.screenshot({ path: "/tmp/cvory-global-status-modal.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "改名样式日常版式" }),
  ).toBeVisible();
});
