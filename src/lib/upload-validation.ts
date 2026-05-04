const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

type AllowedImageMimeType = (typeof ALLOWED_TYPES)[number];

const EXTENSION_MIME_TYPES: Record<string, AllowedImageMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export function detectImageMimeType(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") {
      return "image/gif";
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function isAllowedImageUpload(input: {
  declaredType: string;
  extension: string;
  buffer: Buffer;
}): { ok: true; mimeType: AllowedImageMimeType } | { ok: false; reason: string } {
  const extension = input.extension.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension) || !EXTENSION_MIME_TYPES[extension]) {
    return { ok: false, reason: "File extension not allowed. Use jpg, jpeg, png, gif, or webp." };
  }

  if (!ALLOWED_TYPES.includes(input.declaredType as AllowedImageMimeType)) {
    return { ok: false, reason: "File type not allowed. Use JPEG, PNG, GIF, or WebP." };
  }

  const detectedType = detectImageMimeType(input.buffer);
  if (!detectedType) {
    return { ok: false, reason: "File content is not a supported image." };
  }

  if (detectedType !== input.declaredType || detectedType !== EXTENSION_MIME_TYPES[extension]) {
    return { ok: false, reason: "File content does not match declared type." };
  }

  return { ok: true, mimeType: detectedType };
}
