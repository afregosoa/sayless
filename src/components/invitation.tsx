import { themeCss } from "@/lib/event-content";
import { TEMPLATE_COMPONENTS } from "@/templates/registry";
import type { TemplateProps } from "@/templates/types";

// Despachador: elige el diseño según event.template. Todas las plantillas reciben los mismos datos.
// Los colores del cliente (event.theme) se aplican aquí, una sola vez, para cualquier plantilla.
export function Invitation(props: TemplateProps) {
  const css = themeCss(props.event.theme);
  const Template = TEMPLATE_COMPONENTS[props.event.template];
  return (
    <>
      {css && <style>{css}</style>}
      <Template {...props} />
    </>
  );
}
