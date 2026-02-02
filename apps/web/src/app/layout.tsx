import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Itemize-It | Expense Tracking for Solopreneurs",
  description:
    "Item-level receipt splitting to prevent margin leakage. Built for contractors, lawyers, and consultants.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-asphalt text-white antialiased">{children}</body>
    </html>
  );
}
