/** Shrink a picked photo to fit `max` pixels and return it as a JPEG data URL small enough to store with the record. */
export async function resizeImage(file: File, max: number, quality = 0.78): Promise<string> {
  // Phones often leave file.type empty for camera-roll pictures. Reject only a type that isn't an image.
  if (file.type && !file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That picture couldn't be read.");
  });
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
