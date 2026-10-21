import { DM_Sans, Syne } from "next/font/google";

const display = Syne({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--tpl-display" });
const body = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "700"], variable: "--tpl-body" });

export const modernoFonts = `${display.variable} ${body.variable}`;
