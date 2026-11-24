import { generateService } from "@umijs/openapi";

const schemaPath = process.env.OPENAPI_SCHEMA_URL ?? "http://127.0.0.1:3001/api/docs-json";

await generateService({
  schemaPath,
  serversPath: "./src/services",
  requestLibPath: 'import { httpRequest } from "@/lib/api/http"',
});
