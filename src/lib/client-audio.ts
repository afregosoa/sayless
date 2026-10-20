// Recomprime un MP3 en el navegador cuando pesa más que el límite de subida (ver audio-limits.ts).
// Se decodifica con Web Audio y se vuelve a codificar a MP3 con la tasa más alta que quepa.
// La librería de codificación se carga solo cuando hace falta (import dinámico).
const SAMPLE_RATE = 44100;
const MAX_INPUT_BYTES = 40 * 1024 * 1024; // más allá de esto, decodificar consume demasiada memoria en un celular
const BITRATES = [128, 112, 96, 80, 64, 48]; // kbps; de 80 hacia abajo se usa mono
const BLOCK = 1152;

export class CompressError extends Error {}

function toInt16(samples: Float32Array) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function compressMp3(
  file: File,
  maxBytes: number,
  onProgress?: (fraction: number, phase: "decode" | "encode") => void,
): Promise<File> {
  if (file.size > MAX_INPUT_BYTES) throw new CompressError("El archivo es demasiado grande para comprimirlo aquí (máx. 40 MB).");

  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx({ sampleRate: SAMPLE_RATE });
  let buffer: AudioBuffer;
  try {
    onProgress?.(0, "decode");
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new CompressError("No pudimos leer ese audio para comprimirlo. Prueba con otro MP3.");
  } finally {
    void ctx.close();
  }

  // La tasa más alta cuyo tamaño estimado cabe con un 5 % de margen (cabeceras y redondeos).
  const kbps = BITRATES.find((b) => (buffer.duration * b * 1000) / 8 <= maxBytes * 0.95);
  if (!kbps) throw new CompressError("La canción es demasiado larga. Recórtala a unos 10 minutos o menos e intenta de nuevo.");

  const stereo = kbps >= 96 && buffer.numberOfChannels > 1;
  const left = toInt16(buffer.getChannelData(0));
  const right = stereo ? toInt16(buffer.getChannelData(1)) : undefined;
  // En mono se promedian los canales para no perder una de las pistas.
  const second = !stereo && buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : undefined;
  const mono = second ? toInt16(Float32Array.from(buffer.getChannelData(0), (v, i) => (v + second[i]) / 2)) : left;

  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(stereo ? 2 : 1, SAMPLE_RATE, kbps);
  const parts: Uint8Array[] = [];
  const total = left.length;
  for (let i = 0, n = 0; i < total; i += BLOCK, n++) {
    const chunk = stereo
      ? encoder.encodeBuffer(left.subarray(i, i + BLOCK), right!.subarray(i, i + BLOCK))
      : encoder.encodeBuffer(mono.subarray(i, i + BLOCK));
    if (chunk.length) parts.push(chunk);
    if (n % 200 === 0) { // cede el hilo para que la pantalla muestre el avance
      onProgress?.(i / total, "encode");
      await new Promise((r) => setTimeout(r));
    }
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(tail);
  onProgress?.(1, "encode");

  const blob = new Blob(parts as BlobPart[], { type: "audio/mpeg" });
  if (blob.size > maxBytes) throw new CompressError("Aun comprimida, la canción pesa demasiado. Recórtala e intenta de nuevo.");
  return new File([blob], file.name.replace(/\.mp3$/i, "") + ".mp3", { type: "audio/mpeg" });
}
