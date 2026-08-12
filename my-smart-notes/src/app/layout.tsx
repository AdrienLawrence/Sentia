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
  metadataBase: new URL("https://sentia-nu.vercel.app"),
  applicationName: "Sentia",
  title: {
    default: "Sentia — AI-Powered Notes and Study Tools",
    template: "%s | Sentia",
  },
  description:
    "Write organized notes, ask questions grounded in your notebooks, and create adaptive study quizzes with Sentia.",
  keywords: [
    "AI note taking",
    "student notes",
    "study tools",
    "AI quizzes",
    "notebook editor",
    "Markdown notes",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Sentia",
    title: "Sentia — AI-Powered Notes and Study Tools",
    description:
      "Write organized notes, ask questions grounded in your notebooks, and create adaptive study quizzes.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Sentia AI-powered notes and study tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sentia — AI-Powered Notes and Study Tools",
    description:
      "Write organized notes, ask questions grounded in your notebooks, and create adaptive study quizzes.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/sentia-mark.svg", type: "image/svg+xml" }],
  },
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
