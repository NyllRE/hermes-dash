import { promises as fs } from "node:fs";
import path from "node:path";
import { assertDashboardAccess } from "../../utils/dashboardAuth";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
};

export default defineEventHandler(async (event) => {
  assertDashboardAccess(event);

  const query = getQuery(event);
  const rawPath = query.path;
  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    throw createError({ statusCode: 400, message: "Missing or invalid path query param" });
  }
  const filePath = rawPath;

  // The file root is configurable and defaults to the project root
  // (process.cwd()), not a machine-specific home path.
  const root = path.resolve(process.env.NUXT_DASHBOARD_FILE_ROOT || process.cwd());
  let realRoot: string;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    throw createError({ statusCode: 403, message: "Access denied" });
  }

  // Resolve symlinks so a link inside the root cannot escape the boundary.
  let realFile: string;
  try {
    realFile = await fs.realpath(path.resolve(filePath));
  } catch {
    throw createError({ statusCode: 404, message: "File not found" });
  }

  // Directory-boundary check against the resolved real root.
  if (!realFile.startsWith(realRoot + path.sep)) {
    throw createError({ statusCode: 403, message: "Access denied" });
  }

  // Only regular files are served.
  let stat;
  try {
    stat = await fs.stat(realFile);
  } catch {
    throw createError({ statusCode: 404, message: "File not found" });
  }
  if (!stat.isFile()) {
    throw createError({ statusCode: 403, message: "Access denied" });
  }

  const ext = path.extname(realFile).toLowerCase();
  const mime = IMAGE_MIME[ext];
  if (!mime) {
    throw createError({ statusCode: 415, message: "Unsupported file type" });
  }

  setHeader(event, "Content-Type", mime);
  setHeader(event, "Cache-Control", "private, max-age=86400");

  return fs.readFile(realFile);
});
