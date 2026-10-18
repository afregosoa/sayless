export type Access = "owner" | "editor" | "support" | "readonly";

/**
 * Qué puede hacer el usuario sobre un evento. La base de datos (RLS) es la defensa real;
 * esto solo decide qué mostrar en pantalla.
 *  - owner: es su evento (paga, da acceso de soporte y administra colaboradores).
 *  - editor: colaborador; edita contenido, fotos e invitados.
 *  - support: es superadmin y el cliente le dio acceso de soporte vigente.
 *  - readonly: es superadmin sin acceso de soporte (solo ve estado y conteos).
 * Debe llamarse después de `await connection()` (p. ej. tras getCurrentUser) por el uso de la hora actual.
 */
export function eventAccess(
  user: { id: string; isSuperadmin: boolean },
  event: { owner_id: string | null; support_access_until: string | null },
  isMember: boolean,
): Access {
  if (event.owner_id === user.id) return "owner";
  if (isMember) return "editor";
  if (user.isSuperadmin && event.support_access_until && new Date(event.support_access_until) > new Date()) {
    return "support";
  }
  return "readonly";
}

export const canWork = (a: Access) => a !== "readonly";
