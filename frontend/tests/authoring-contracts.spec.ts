import { test, expect } from "@playwright/test";
import {
  bodyMarkdown,
  parseBodyMarkdown,
  plainBody,
} from "../src/lib/resume/body-markdown";
import {
  parseRecovery,
  recoveryKey,
  writeRecovery,
  readRecoveries,
} from "../src/lib/resume/recovery";
import { blankProfile, DEFAULT_STYLE } from "../src/lib/resume/model";
test("Markdown round trips nested lists, ordered starts, links, code and literal punctuation", () => {
  const source =
    "**加粗**与 *斜体* 和 `x*y` [项目](https://example.com)\n\n3. 有序\n   - 嵌套内容\n4. 第二项\n\n\\*原样星号\\*";
  const doc = parseBodyMarkdown(source);
  expect(JSON.stringify(doc)).toContain('"type":"code"');
  expect(JSON.stringify(doc)).toContain('"start":3');
  expect(parseBodyMarkdown(bodyMarkdown(doc))).toEqual(doc);
  expect(
    parseBodyMarkdown(bodyMarkdown(plainBody("*文字* [文字](url) `代码`"))),
  ).toEqual(plainBody("*文字* [文字](url) `代码`"));
  for (const source of [
    "***同时强调***",
    "**`带格式的代码`**",
    "第一行  \n第二行",
    "段落一\n\n\n\n段落二",
    "[地址](example.com)",
  ]) {
    const value = parseBodyMarkdown(source);
    expect(parseBodyMarkdown(bodyMarkdown(value))).toEqual(value);
  }
  expect(() =>
    bodyMarkdown({
      type: "doc",
      content: [
        { type: "orderedList", attrs: { type: "a", start: 1 }, content: [] },
      ],
    }),
  ).toThrow();
});
test("unsupported Markdown, unsafe links and oversized input require an explicit choice", () => {
  for (const source of [
    "# 标题",
    "![图](https://example.com/a.png)",
    "<script>alert(1)</script>",
    "[链接](javascript:alert)",
    "- [x] 任务",
    "|a|b|\n|-|-|\n|1|2|",
    "```js\na()\n```",
    "x".repeat(150001),
  ])
    expect(() => parseBodyMarkdown(source)).toThrow();
});
test("recovery is bounded and isolated by owner, CV and editing tab", () => {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
  const value = {
    version: 1 as const,
    owner: "a",
    cv: "cv",
    baseEtag: "base",
    time: new Date().toISOString(),
    document: {
      displayName: "",
      profile: blankProfile(),
      sections: [],
      styleSettings: DEFAULT_STYLE,
    },
    scratch: { markdown: { summary: "# 待确认正文" } },
  };
  writeRecovery(storage, recoveryKey("a", "cv", "tab-1"), value);
  writeRecovery(storage, recoveryKey("a", "cv", "tab-2"), value);
  expect(readRecoveries(storage, "a", "cv").results).toHaveLength(2);
  expect(readRecoveries(storage, "b", "cv").results).toHaveLength(0);
  expect(() => parseRecovery(JSON.stringify(value), "b", "cv")).toThrow();
  expect(() =>
    parseRecovery(JSON.stringify({ ...value, version: 99 }), "a", "cv"),
  ).toThrow();
  expect(
    parseRecovery(JSON.stringify(value), "a", "cv").document.displayName,
  ).toBe("");
  expect(
    parseRecovery(
      JSON.stringify({
        ...value,
        scratch: { markdown: { summary: "x".repeat(150001) } },
      }),
      "a",
      "cv",
    ).scratch.markdown?.summary,
  ).toHaveLength(150001);
  expect(() =>
    writeRecovery(storage, "too-large", {
      ...value,
      scratch: { markdown: { x: "x".repeat(4 * 1024 * 1024) } },
    }),
  ).toThrow();
});
