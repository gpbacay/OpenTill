import { BadRequestException } from "@nestjs/common";

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_LENGTH = 200_000;

/** An optional picture: "" clears it, otherwise a small base64 image data URL (the browser resizes it first). */
export function cleanImage(value: unknown): string {
  if (value === "" || value === null) return "";
  if (typeof value !== "string" || value.length > MAX_LENGTH || !DATA_URL.test(value)) {
    throw new BadRequestException("Pictures must be a JPEG, PNG or WebP image under 150 KB.");
  }
  return value;
}
