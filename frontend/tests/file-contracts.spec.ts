import { test, expect } from "@playwright/test";
import { parseBackup, parseMarkdown, markdown } from "../src/lib/resume/files";
import {
  blankProfile,
  completeResume,
  textContent,
  DEFAULT_STYLE,
  safeLink,
  dateLabel,
} from "../src/lib/resume/model";
test("unsupported backup structures fail before rendering", () => {
  for (const input of [
    "broken",
    "{}",
    '{"format":"cvory","version":99}',
    '{"format":"cvory","version":1,"document":{"profile":"wrong","sections":[4],"styleSettings":{}}}',
  ])
    expect(() => parseBackup(input)).toThrow();
});
test("Markdown keeps prose, lists and supported marks without inventing dates", async () => {
  const candidate = await parseMarkdown(
    "# 张三\n前端工程师\n## 技能\n- **React** 与 [项目](https://example.com)\n- TypeScript",
  );
  expect(candidate.profile?.fullName).toBe("张三");
  expect(candidate.sections).toHaveLength(1);
  expect(textContent(candidate.sections![0].content)).toContain("React");
  expect(candidate.sections![0].items).toEqual([]);
  expect(await markdown(completeResume(candidate))).toContain("**React**");
});
test("hidden contact data stays out of Markdown and link protocols are constrained", async () => {
  const text = await markdown({
    profile: {
      ...blankProfile(),
      fullName: "Name",
      email: "PRIVATE_HIDDEN_EMAIL@example.com",
      hiddenFields: ["email"],
    },
    sections: [],
    styleSettings: DEFAULT_STYLE,
  });
  expect(text).not.toContain("PRIVATE_HIDDEN_EMAIL");
  expect(safeLink("javascript:alert(1)")).toBeUndefined();
  expect(safeLink("https://example.com")).toBe("https://example.com/");
  expect(
    dateLabel(
      { id: "item", startDate: "2022-09", endDate: "2024-06", current: true },
      "education",
    ),
  ).toBe("2022.09 — 在读");
});
