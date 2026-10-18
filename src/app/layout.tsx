import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Poppins, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const script = Mrs_Saint_Delafield({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "SayLess", template: "%s · SayLess" },
  description: "Invitaciones digitales con confirmación de asistencia para tus eventos.",
};

export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${bodoni.variable} ${poppins.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
