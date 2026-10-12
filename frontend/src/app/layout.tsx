import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "El-Sharnouby Operations Control",
  description: "Executive operations AI platform for El-Sharnouby Group / Leo Moda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
