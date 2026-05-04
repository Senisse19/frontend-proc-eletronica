import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          bronze: "#927245",
          duna: "#D5AE77",
          taupe: "#322E2B",
          snow: "#FDFDFD",
          light: "#EBEBEB",
          graphite: "#1F1F1F",
          neutral: "#CDCDCD",
          dark: "#828384",
        }
      },
    },
  },
  plugins: [],
};
export default config;
