import { expect, test } from "@playwright/test";
for (const [name, width] of [
  ["desktop", 1440],
  ["mobile", 390],
] as const) {
  test(`${name}: account access makes unavailable recovery explicit without broken actions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/workspace");
    await page.getByRole("button", { name: "登录或注册", exact: true }).click();
    await page.getByRole("button", { name: "还没有账户？注册" }).click();
    await page
      .getByLabel("邮箱")
      .fill(`access-${crypto.randomUUID()}@example.com`);
    await page.getByLabel("密码", { exact: true }).fill("access-test-password");
    await page.getByRole("button", { name: "注册并开始" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/settings/access");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "邮箱恢复与账户注销暂未开放" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "发送验证邮件" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "注销账户", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "管理 GitHub 连接" }),
    ).toBeVisible();
  });
}
