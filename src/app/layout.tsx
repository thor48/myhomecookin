import type { Metadata, Viewport } from "next";
import { Caveat, Lato, Playfair_Display } from "next/font/google";
import "./globals.css";

// Style guide: Playfair Display for headings, Lato for body/UI, and Caveat
// only for short decorative labels (like who a recipe is from).
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600"] });

import { SITE_NAME, SITE_SHORT_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Recipes our friends and family love to make.",
  appleWebApp: { capable: true, title: SITE_SHORT_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f8f1e9",
};

// Chrome can offer "install" before React is ready; keep its prompt on window
// for the footer's Add to Home Screen button (src/components/pwa.tsx).
const CAPTURE_INSTALL_PROMPT = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;dispatchEvent(new Event("installpromptready"))});addEventListener("appinstalled",function(){window.__installPrompt=null;dispatchEvent(new Event("installpromptready"))});`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${playfair.variable} ${lato.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <script dangerouslySetInnerHTML={{ __html: CAPTURE_INSTALL_PROMPT }} />
        {children}
      </body>
    </html>
  );
}
