import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto_Condensed } from "next/font/google";
import "./globals.css";
import { APP_THEME_KEY, LEGACY_EDITOR_THEME_KEY } from "@/features/theme/appTheme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const robotoCondensed = Roboto_Condensed({
  variable: "--font-roboto-condensed",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sentia",
    template: "%s | Sentia",
  },
  description:
    "A focused notebook editor with grounded AI study and writing tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('${APP_THEME_KEY}')||localStorage.getItem('${LEGACY_EDITOR_THEME_KEY}');t=t==='light'?'light':'dark';document.documentElement.dataset.appTheme=t;document.documentElement.style.colorScheme=t}catch(e){document.documentElement.dataset.appTheme='dark'}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${robotoCondensed.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
