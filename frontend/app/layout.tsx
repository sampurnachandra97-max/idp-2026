import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soil Intelligence",
  description:
    "Machine learning that estimates soil properties from a routine test, flags crop stress and ranks suitable crops.",
};

export const viewport: Viewport = { themeColor: "#2f8fe3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions can add attributes to <html> before React loads. This covers
    // only this element's own attributes, so real mismatches in the page still report.
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
