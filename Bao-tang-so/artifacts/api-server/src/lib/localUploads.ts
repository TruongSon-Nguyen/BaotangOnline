import path from "node:path";

export const localUploadDirectory =
  process.env.BAOTANG_UPLOAD_DIR ??
  path.resolve(process.cwd(), ".local", "uploads");
