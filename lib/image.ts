/** File-picker filter. `image/*` hides .heic on Windows, so the extensions are listed too. */
export const PHOTO_ACCEPT = "image/*,image/heic,image/heif,.heic,.heif";

const HEIC_NAME = /\.hei[cf]$/i;

/** Phones often leave file.type empty. Windows reports a .heic file as octet-stream. */
export function isPhotoFile(file: { type: string; name: string }): boolean {
  const type = file.type.toLowerCase();
  if (!type || type.startsWith("image/")) return true;
  return HEIC_NAME.test(file.name);
}

function isHeicFile(file: File): boolean {
  return HEIC_NAME.test(file.name) || /^image\/hei[cf]/.test(file.type.toLowerCase());
}

/** Shrink a picked photo to fit `max` pixels and return it as a JPEG data URL small enough to store with the record. */
export async function resizeImage(file: File, max: number, quality = 0.78): Promise<string> {
  if (!isPhotoFile(file)) throw new Error("Choose an image file.");
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't resize pictures.");
  context.fillStyle = "#fff"; // JPEG has no transparency
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let q = quality;
  let url = canvas.toDataURL("image/jpeg", q);
  // The API refuses pictures over ~150 KB. A busy photo can exceed that at the starting quality.
  while (url.length > 150_000 && q > 0.45) {
    q = Math.round((q - 0.1) * 100) / 100;
    url = canvas.toDataURL("image/jpeg", q);
  }
  if (url.length > 150_000) throw new Error("That picture is still too large. Try another one.");
  return url;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Safari decodes HEIC itself. Other browsers need a converter, then the same JPEG shrink above.
    if (!isHeicFile(file)) throw new Error("That picture couldn't be read.");
    try {
      // ponytail: HEIC decode runs on the main thread. Move to heic-to/next in a worker if a phone photo hitches the page.
      const { heicTo } = await import("heic-to");
      return await heicTo({ blob: file, type: "bitmap" });
    } catch {
      throw new Error("That picture couldn't be read.");
    }
  }
}

function selfCheck() {
  const cases: [boolean, { type: string; name: string }][] = [
    [true, { type: "", name: "IMG.HEIC" }],
    [true, { type: "image/jpeg", name: "a.jpg" }],
    [true, { type: "image/png", name: "a.png" }],
    [true, { type: "image/heic", name: "a" }],
    [true, { type: "image/heif", name: "a" }],
    [true, { type: "application/octet-stream", name: "photo.heic" }],
    [true, { type: "application/octet-stream", name: "photo.HEIF" }],
    [false, { type: "application/pdf", name: "a.pdf" }],
    [false, { type: "application/octet-stream", name: "a.bin" }],
    [false, { type: "text/plain", name: "notes.heic.txt" }],
  ];
  for (const [ok, file] of cases) {
    if (isPhotoFile(file) !== ok) throw new Error(`isPhotoFile ${file.type} ${file.name}`);
  }
  if (!PHOTO_ACCEPT.includes(".heic") || !PHOTO_ACCEPT.includes(".heif")) throw new Error("picker filter");
  console.log("ok - photo file check");
}

if (typeof window === "undefined" && process.argv[1]?.replaceAll("\\", "/").endsWith("lib/image.ts")) selfCheck();
