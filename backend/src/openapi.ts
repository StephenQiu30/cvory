import {writeFile} from 'node:fs/promises';
import {createApp, openapi} from './app';
import {Config} from './config/config';
async function main(): Promise<void> {
  // Creating the document does not connect to MySQL or require provider credentials.
  const app = await createApp(new Config({DATABASE_URL: 'mysql://localhost/cvory_schema'}));
  try {
    const document = openapi(app);
    await writeFile('openapi.json', JSON.stringify(document, null, 2) + '\n');
  } finally {
    await app.close();
  }
}
void main().catch((error) => {
  process.stderr.write(`OpenAPI generation failed: ${String(error)}\n`);
  process.exitCode = 1;
});
