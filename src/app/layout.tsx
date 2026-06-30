import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AppSidebar } from "./app-sidebar";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins"
});

export const metadata: Metadata = {
  title: "EI Designer",
  description: "Engineering symbol registry and structured SVG drawing workspace"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <div className="app-shell">
          <AppSidebar />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
