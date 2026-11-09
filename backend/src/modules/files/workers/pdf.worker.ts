import {chromium, Browser} from 'playwright';
let activeBrowser: Browser | undefined;
const shutdown = () => {
  void (activeBrowser ? activeBrowser.close() : Promise.resolve()).finally(() => process.exit(0));
};
process.once('SIGTERM', shutdown);
process.once('disconnect', shutdown);
process.once('message', (input: unknown) => {
  void (async () => {
    if (!input || typeof input !== 'object' || !('url' in input) || typeof input.url !== 'string')
      throw new Error('Invalid render input.');
    const url = new URL(input.url);
    if (!['http:', 'https:'].includes(url.protocol) || !/^\/print\/[\w-]{43}$/.test(url.pathname))
      throw new Error('Invalid print route.');
    const browser = (activeBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    }));
    try {
      const page = await browser.newPage();
      await page.route('**/*', (route) => {
        const target = new URL(route.request().url());
        return target.protocol === 'data:' || target.origin === url.origin
          ? route.continue()
          : route.abort();
      });
      const response = await page.goto(url.toString(), {waitUntil: 'networkidle', timeout: 40000});
      if (!response?.ok()) throw new Error('Print route failed.');
      await page.waitForSelector('[data-print-ready="true"]', {timeout: 20000});
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map(async (image) => {
            if (!image.complete) await image.decode();
            if (!image.naturalWidth) throw new Error('Image failed.');
          }),
        );
        for (const face of document.fonts)
          if (face.status === 'error') throw new Error('Font failed.');
      });
      const bytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
      });
      if (bytes.length > 20971520) throw new Error('PDF too large.');
      return bytes;
    } finally {
      await browser.close();
    }
  })()
    .then((data) => {
      process.send?.({data}, () => process.exit(0));
    })
    .catch(() => {
      process.send?.({error: true}, () => process.exit(0));
    });
});
