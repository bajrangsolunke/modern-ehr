/**
 * Resize an image File into a data URL bounded by maxW × maxH while keeping
 * aspect ratio. Used for inline profile photos so we don't shove multi-MB
 * blobs through PATCH. Outputs JPEG at the given quality (default 0.85),
 * which keeps a 3:4 portrait around 30–80 KB.
 */
export async function fileToBoundedDataUrl(
  file: File,
  maxW = 360,
  maxH = 480,
  quality = 0.85
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please pick an image file");
  }

  const bitmap = await loadImage(file);
  const ratio = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  // toDataURL returns "data:image/jpeg;base64,..." — safe to PATCH.
  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Couldn't decode image"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Couldn't read file"));
    reader.readAsDataURL(file);
  });
}
