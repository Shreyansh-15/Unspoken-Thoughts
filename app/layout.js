import { Playfair_Display, Crimson_Text } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const crimson = Crimson_Text({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata = {
  title: "Unspoken Thoughts",
  description: "Write. Breathe. Save what matters. Release what doesn't.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#0a090e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${crimson.variable}`}>
        {children}
      </body>
    </html>
  );
}