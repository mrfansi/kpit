import assert from "node:assert/strict";
import test from "node:test";
import { detectImageMimeType, isAllowedImageUpload } from "./upload-validation";

test("detects image MIME type from magic bytes", () => {
  assert.equal(detectImageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    detectImageMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png"
  );
  assert.equal(detectImageMimeType(Buffer.from("GIF89a")), "image/gif");
  assert.equal(detectImageMimeType(Buffer.from("RIFF1234WEBP")), "image/webp");
});

test("rejects spoofed image uploads when declared type does not match bytes", () => {
  const result = isAllowedImageUpload({
    declaredType: "image/png",
    extension: "png",
    buffer: Buffer.from("not an image"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "File content is not a supported image.");
});

test("rejects valid image bytes with mismatched declared type", () => {
  const result = isAllowedImageUpload({
    declaredType: "image/png",
    extension: "png",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "File content does not match declared type.");
});
