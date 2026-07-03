export function fileUrlToServed(fileUrl: string): string {
  if (!fileUrl.startsWith("file://")) return fileUrl;
  const filePath = fileUrl.slice("file://".length);
  return `/api/files/read?path=${encodeURIComponent(filePath)}`;
}
