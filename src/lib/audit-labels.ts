const COLUMN_LABELS: Record<string, string> = {
  content: "el contenido", theme: "los colores", title: "el nombre", event_date: "la fecha",
  rsvp_deadline: "la fecha límite", support_access_until: "el acceso de soporte",
};

/** Texto legible de una entrada del registro de actividad. */
export function auditLabel(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case "support_view": return "Soporte abrió tu evento";
    case "support_edit_event": {
      const changed = Array.isArray(details.changed) ? (details.changed as string[]) : [];
      const what = changed.map((c) => COLUMN_LABELS[c] ?? c).join(", ");
      return `Soporte editó ${what || "el evento"}`;
    }
    case "support_guest_insert": return "Soporte agregó un invitado";
    case "support_guest_update": return "Soporte modificó un invitado";
    case "support_guest_delete": return "Soporte eliminó un invitado";
    case "status_changed": return `Estado cambiado a "${String(details.status ?? "")}"`;
    case "paid_changed": return details.paid ? "Pago registrado" : "Pago retirado";
    case "owner_assigned": return "Evento asignado a un nuevo dueño";
    case "owner_invited": return "Evento reservado para un correo aún sin registrar";
    case "member_added": return `Colaborador agregado: ${String(details.email ?? "")}`;
    case "member_removed": return `Colaborador quitado: ${String(details.email ?? "")}`;
    case "retention_toggled": return details.enabled ? "Borrado automático encendido" : "Borrado automático apagado";
    case "event_auto_closed": return "El evento se cerró automáticamente después de su fecha";
    case "guests_anonymized": {
      const n = typeof details.count === "number" ? ` (${details.count})` : "";
      return details.reason === "owner_request"
        ? `Datos de invitados eliminados a tu solicitud${n}`
        : `Datos de invitados eliminados por política de retención${n}`;
    }
    case "music_rights_accepted": return "Aceptaste la declaración de derechos de la música";
    case "event_created_for_client": return "Evento creado por soporte";
    default: return action;
  }
}
