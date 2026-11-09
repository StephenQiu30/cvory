import path from "node:path";
import type { GenerateServiceProps } from "@umijs/openapi";
const config: GenerateServiceProps = {
  schemaPath: path.resolve(process.cwd(), "../backend/openapi.json"),
  serversPath: "./src/lib/api/generated",
  requestLibPath: "@/lib/api/request",
  hook: {
    customType: (schema, namespace, original) =>
      schema?.nullable
        ? `${original({ ...schema, nullable: false }, namespace)} | null`
        : original(schema, namespace),
    // @umijs/openapi treats AIP :verbs as Express parameters. Encode the literal colon.
    afterOpenApiDataInited: (schema) => ({
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
