import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.CV_TEST_NEST !== "true",
  "Requires the isolated Nest/MySQL browser fixture.",
);
async function signup(page: Page) {
  await page.goto("/workspace");
  await page.getByRole("button", { name: "登录或注册", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "使用 GitHub 登录" }),
  ).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page.getByLabel("显示名称").fill("Nest 浏览器验收");
  await page
    .getByLabel("邮箱")
    .fill(`nest-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("密码", { exact: true }).fill("browser-test-password");
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("saved revisions restore to a separate CV while the current unsaved editor input survives", async ({
  page,
}) => {
  await signup(page);
  const created = await page.request.post("/api/cvs", {
    data: { displayName: "浏览器历史初稿" },
  });
  expect(created.status()).toBe(201);
  const cv = await created.json();
  await page.goto(`/cvs/${cv.id}`);
  const name = page.getByRole("textbox", { name: "简历名称", exact: true });
  await expect(name).toHaveValue("浏览器历史初稿");
  await name.fill("浏览器已保存版本");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存" }),
  ).toBeVisible();
  await name.fill("尚未保存的当前输入");
  await page.getByRole("button", { name: "修订历史", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("最近 50 个已保存版本");
  await expect(dialog.getByRole("button", { name: "恢复为副本" })).toHaveCount(
    2,
  );
  await dialog.getByRole("button", { name: "恢复为副本" }).last().click();
  await expect(dialog).toContainText("已恢复为独立副本");
  await dialog.getByRole("button", { name: "关闭对话框" }).click();
  await expect(name).toHaveValue("尚未保存的当前输入");
  const list = await (await page.request.get("/api/cvs")).json();
  expect(
    list.cvs.map((item: { displayName: string }) => item.displayName).sort(),
  ).toEqual(["浏览器历史初稿", "浏览器已保存版本"].sort());
});

test("a legacy account binds GitHub through real callback handling and explicitly reads public repositories", async ({
  page,
}) => {
  await signup(page);
  await page.route("**/api/account/github/link?**", async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    expect(response.status()).toBe(303);
    const authorization = new URL(response.headers().location);
    expect(authorization.origin).toBe("https://github.com");
    const state = authorization.searchParams.get("state");
    const target = new URL(
      `/api/account/github/callback?state=${state}&code=browser-fixture`,
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
  await expect(
    page.getByRole("link", {
      name: "cvory-fixture/resume-project",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "读取公开仓库" }).click();
  await expect(
    page.getByRole("link", {
      name: "cvory-fixture/resume-project",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("读取结果不会自动发布。", { exact: false }),
  ).toBeVisible();
});

test("mobile login explains unconfigured GitHub and respects disabled legacy registration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/account/auth-options", (route) =>
    route.fulfill({
      json: {
        githubEnabled: false,
        legacyRegistrationEnabled: false,
        legacyRecoveryEnabled: false,
      },
    }),
  );
  await page.goto("/workspace");
  await page.getByRole("button", { name: "登录或注册", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("GitHub 登录尚未配置");
  await expect(
    page.getByRole("button", { name: "还没有账户？注册" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "忘记密码" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
