import { test, expect } from '@playwright/test';

test('opens the CVory knowledge base from the home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '简序知识库',
  );
  await page.getByRole('link', { name: '进入文档中心' }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.locator('article')).toContainText('从这里开始');
});

test('opens a requirement, its source, Markdown and search result', async ({
  page,
}) => {
  await page.goto('/docs');
  await page
    .locator('article')
    .getByRole('link', { name: '需求 01 · 极简简历制作' })
    .click();

  const path = '/docs/requirement/01-极简简历制作需求';
  await expect(page).toHaveURL((url) => decodeURI(url.pathname) === path);
  await expect(page.locator('article')).toContainText('FR-CV-01');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Open in GitHub' }),
  ).toHaveAttribute(
    'href',
    'https://github.com/StephenQiu30/cvory/blob/main/workspace/content/' +
      encodeURI('requirement/01-极简简历制作需求.md'),
  );
  await expect(
    page.getByRole('link', { name: 'View as Markdown' }),
  ).toHaveAttribute('href', encodeURI(path + '.md'));
  const markdown = await page.request.get(path + '.md');
  expect(markdown.ok()).toBe(true);
  expect(await markdown.text()).toContain('FR-CV-01');

  const search = await page.request.get('/api/search', {
    params: { query: '极简简历制作需求' },
  });
  expect(search.ok()).toBe(true);
  const results: { url: string }[] = await search.json();
  expect(
    results.some((result) => decodeURI(result.url).split('#')[0] === path),
  ).toBe(true);
});

test('renders the research screenshot and links its mobile example', async ({
  page,
}) => {
  await page.goto('/docs');
  await page
    .locator('article')
    .getByRole('link', { name: /调研 05/ })
    .click();
  const paper = page.locator('article');
  const screenshot = paper.getByRole('img', { name: /老鱼公开/ });
  await screenshot.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      screenshot.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const mobile = paper.getByRole('link', { name: '390px 首屏原图' });
  const response = await page.request.get((await mobile.getAttribute('href'))!);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
});

test('follows the product documents and shows their file numbers', async ({
  page,
}) => {
  await page.goto('/docs');
  const article = page.locator('article');
  await article.getByRole('link', { name: '设计 01 · 在线简历制作' }).click();
  await expect(page).toHaveTitle('01 · 在线简历制作设计');
  await article.getByRole('link', { name: '首版 PRD', exact: true }).click();
  await expect(page).toHaveTitle('01 · 在线简历制作 PRD');
  await article.getByRole('link', { name: '执行计划', exact: true }).click();
  await expect(page).toHaveTitle('01 · 在线简历制作执行计划');
  await expect(article).toContainText('CASE-CV-06');
});
