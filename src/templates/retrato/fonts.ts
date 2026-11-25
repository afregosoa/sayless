import { Cormorant_Garamond, Jost } from "next/font/google";
import localFont from "next/font/local";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], variable: "--tpl-display" });
const body = Jost({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--tpl-body" });
// Fuente de las frases especiales (la "y" entre los nombres, "Se van a casar", las palabras en acento). Para cambiarla basta con editar esta línea.
const script = localFont({ src: "./fonts/SanliurfaRegular.woff2", weight: "400", display: "swap", variable: "--tpl-script" });

// Fuente de los nombres de la pareja en la portada.
const names = localFont({ src: "./fonts/SafiraMarchThin.woff2", weight: "400", display: "swap", variable: "--tpl-names" });

// Fuente de la invitación en la parte de arriba de la portada.
const top = localFont({ src: "./fonts/RiseOfBeautyThin.woff2", weight: "400", display: "swap", variable: "--tpl-top" });

// Fuente de la fecha en la portada.
const date = localFont({ src: "./fonts/SafiraMarchRegular.woff2", weight: "400", display: "swap", variable: "--tpl-date" });

// Fuente de la primera palabra del título de la historia ("Nuestra"). Variable en tamaño óptico (opsz).
const story = localFont({ src: "./fonts/Ballet.woff2", weight: "400", display: "swap", variable: "--tpl-story" });

// Fuente del texto de "Nuestra historia de amor".
const storyBody = localFont({ src: "./fonts/ManjariThin.woff2", weight: "100", display: "swap", variable: "--tpl-story-body" });

export const retratoFonts = `${display.variable} ${body.variable} ${script.variable} ${names.variable} ${top.variable} ${date.variable} ${story.variable} ${storyBody.variable}`;
