import path from "node:path";

export default {
  schemaPath: path.resolve(process.cwd(), "../backend/openapi.json"),
  serversPath: "./src/lib/api/generated",
  requestLibPath: "@/lib/api/request",
};
