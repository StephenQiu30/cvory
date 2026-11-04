import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

for (const [name, width] of [
  ["desktop", 1440],
  ["mobile", 390],
] as const) {
  test(`${name}: verify, reset, request and cancel deletion`, async ({
    browser,
  }) => {
    const mailbox = process.env.CV_TEST_MAILBOX;
    if (!mailbox)
      throw new Error(
        "CV_TEST_MAILBOX must name the isolated test mail capture file.",
      );
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    const email = `lifecycle-${crypto.randomUUID()}@example.com`;
    const password = "eight888";
    const newPassword = "newpass8";
    async function token(purpose: string) {
      let value = "";
      await expect
        .poll(
          async () => {
            try {
              const lines = (await readFile(mailbox!, "utf8"))
                .trim()
                .split("\n");
              const item = lines
                .map((line) => JSON.parse(line))
                .find(
                  (item) =>
                    item.recipient === email && item.purpose === purpose,
                );
              value = item?.token ?? "";
            } catch {
              /* Waiting for the test mail worker. */
            }
            return Boolean(value);
          },
          { timeout: 20000 },
        )
        .toBe(true);
      return value;
    }
    await page.goto("/");
    await page
      .getByRole("button", { name: "登录", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "还没有账户？注册" }).click();
    await page.getByLabel("邮箱").fill(email);
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "注册并开始" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/settings/access");
    await page.getByRole("button", { name: "发送验证邮件" }).click();
    await page.goto(
      `/verify-email#token=${encodeURIComponent(await token("verify_email"))}`,
    );
    await page.getByRole("button", { name: "确认验证" }).click();
    await expect(page.getByText("邮箱验证成功。")).toBeVisible();

    const anonymous = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const guest = await anonymous.newPage();
    await guest.goto("/");
    await guest
      .getByRole("button", { name: "登录", exact: true })
      .first()
      .click();
    await guest.getByRole("button", { name: "忘记密码" }).click();
    await guest.getByLabel("邮箱").fill(email);
    await guest.getByRole("button", { name: "发送重置说明" }).click();
    await expect(
      guest.getByText(
        "如果邮箱符合条件，重置说明将发送到该邮箱。请检查收件箱。",
      ),
    ).toBeVisible();
    await guest.goto(
      `/reset-password#token=${encodeURIComponent(await token("reset_password"))}`,
    );
    await guest.getByLabel("新密码", { exact: true }).fill(newPassword);
    await guest.getByLabel("确认新密码").fill(newPassword);
    await guest.getByRole("button", { name: "重置密码" }).click();
    await expect(guest.getByText("密码已重置，请重新登录。")).toBeVisible();
    await guest.getByRole("button", { name: "返回登录" }).click();
    await guest.getByLabel("邮箱").fill(email);
    await guest.getByLabel("密码", { exact: true }).fill(newPassword);
    await guest.getByRole("button", { name: "登录", exact: true }).click();
    await expect(guest.getByRole("dialog")).toHaveCount(0);
    await guest.goto("/settings/access");
    await guest.getByRole("button", { name: "注销账户", exact: true }).click();
    await guest.locator("#delete-password").fill(newPassword);
    await guest.getByRole("button", { name: "确认注销" }).click();
    await expect(guest.getByRole("dialog")).toHaveCount(0);
    await guest
      .getByRole("button", { name: "登录", exact: true })
      .first()
      .click();
    await guest.getByRole("button", { name: "撤销账户注销" }).click();
    await guest.getByLabel("邮箱").fill(email);
    await guest.getByLabel("密码", { exact: true }).fill(newPassword);
    await guest.getByRole("button", { name: "撤销注销", exact: true }).click();
    await expect(guest.getByText("注销已撤销，请重新登录。")).toBeVisible();
    await guest.getByRole("button", { name: "登录", exact: true }).click();
    await expect(guest.getByRole("dialog")).toHaveCount(0);
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await anonymous.close();
    await context.close();
  });
}
