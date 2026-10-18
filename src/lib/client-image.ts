// Reduce una foto en el navegador antes de subirla. Las fotos de celular pesan varios MB y las
// funciones de Vercel limitan el cuerpo de la petición a ~4.5 MB, así que se envía una versión
// de máx. 2000 px. El servidor la vuelve a procesar y validar de todos modos.
const MAX_SIDE = 2000;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function prepareImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    for (const quality of [0.85, 0.7, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], "foto.webp", { type: "image/webp" });
      }
    }
  } catch {
    // Formato que el navegador no puede decodificar (p. ej. HEIC fuera de Safari): se intenta enviar tal cual.
  }
  return file;
}
