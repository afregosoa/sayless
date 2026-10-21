import type { ReactElement } from "react";
import { Editorial } from "./editorial";
import { Jardin } from "./jardin/jardin";
import { Moderno } from "./moderno/moderno";
import { Sobre } from "./sobre/sobre";
import type { TemplateId } from "./catalog";
import type { TemplateProps } from "./types";

// Cada plantilla es un diseño completo sobre los mismos datos. Una plantilla desconocida cae en la editorial.
export const TEMPLATE_COMPONENTS: Record<TemplateId, (props: TemplateProps) => ReactElement> = {
  editorial: Editorial,
  sobre: Sobre,
  jardin: Jardin,
  moderno: Moderno,
};
