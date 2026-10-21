import { Cormorant_Garamond, Jost, Pinyon_Script } from "next/font/google";

// Las fuentes se cargan solo cuando se muestra esta plantilla.
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], variable: "--tpl-display" });
const script = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--tpl-script" });
const body = Jost({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--tpl-body" });

export const sobreFonts = `${display.variable} ${script.variable} ${body.variable}`;
