import path from "node:path";
const config = {
  schemaPath: path.resolve(process.cwd(), "../backend/openapi.json"),
  serversPath: "./src/lib/api/generated",
  requestLibPath: "@/lib/api/request",
  hook: {
    // @umijs/openapi treats AIP :verbs as Express parameters. Encode the literal colon.
    afterOpenApiDataInited: (schema: { paths: Record<string, unknown> }) => ({
      ...schema,
      paths: Object.fromEntries(
        Object.entries(schema.paths).map(([key, value]) => [
          key.replace(/:/g, "%3A"),
          value,
        ]),
      ),
    }),
  },
};
export default config;
