import { llms, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const docs = defineDocs({
  dir: 'content',
  docs: {
    schema: ({ source, path }) => {
      const filename = path.split('/').at(-1)!;
      const number = /^(\d{2})-/.exec(filename)?.[1];
      const heading =
        source.match(/^#\s+(.+)$/m)?.[1] ??
        filename.replace(/^\d{2}-/, '').replace(/\.mdx?$/, '');
      return pageSchema.extend({
        title: pageSchema.shape.title
          .default(heading)
          .transform((title) => (number ? `${number} · ${title}` : title)),
      });
    },
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
