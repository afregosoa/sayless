import { Fraunces, Lato } from "next/font/google";

// Lato es una fuente estática: Nunito Sans (con varios ejes variables) no la admite el empaquetador con pesos fijos.
const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--tpl-display" });
const body = Lato({ subsets: ["latin"], weight: ["300", "400", "700"], variable: "--tpl-body" });

export const jardinFonts = `${display.variable} ${body.variable}`;
