import { promises as fs } from "node:fs";
import path from "node:path";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const filePath = query.path as string;
  if (!filePath) {
    throw createError({ statusCode: 400, message: "Missing path query param" });
  }

  const resolved = path.resolve(filePath);

  const allowedPrefix = path.resolve("/home/nyll/Development");
  if (!resolved.startsWith(allowedPrefix)) {
    throw createError({ statusCode: 403, message: "Access denied" });
  }

  try {
    await fs.access(resolved, fs.constants.R_OK);
  } catch {
    throw createError({ statusCode: 404, message: "File not found" });
  }

  const ext = path.extname(resolved).toLowerCase();
  const mime: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
  };

  setHeader(event, "Content-Type", mime[ext] || "application/octet-stream");
  setHeader(event, "Cache-Control", "public, max-age=86400");

  return fs.readFile(resolved);
});
