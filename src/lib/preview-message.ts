// Mensajes entre el editor y su vista previa (un iframe del mismo sitio): el editor envía el borrador al instante, sin guardar.
export const PREVIEW_READY = "sayless-preview-ready";
export const PREVIEW_DRAFT = "sayless-preview-draft";
// De la vista previa al editor: el invitado-editor movió o acercó la foto de un lugar arrastrándola sobre la tarjeta.
export const PREVIEW_FRAME = "sayless-preview-frame";
export type PreviewFrameMessage = { type: typeof PREVIEW_FRAME; venue: number; image_x: number; image_y: number; image_zoom: number };
