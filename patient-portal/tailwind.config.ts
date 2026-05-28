import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F8FAF7",
        surface: "#FFFFFF",
        foreground: "#0F1F1A",
        muted: "#5C6F66",
        primary: {
          DEFAULT: "#0E8A6C",
          soft: "#E8F5EF",
          foreground: "#FFFFFF",
        },
        accent: "#B4D7C7",
        danger: "#D04848",
        warning: "#E0A536",
        border: "#E5EDE8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 31, 26, 0.06), 0 2px 8px rgba(15, 31, 26, 0.08)",
      },
      maxWidth: {
        column: "720px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
