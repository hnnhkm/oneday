import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef5f2",
          100: "#fde8e1",
          200: "#fbcec0",
          300: "#f7b09a",
          400: "#f49271",
          500: "#e8764e",
          600: "#d45e38",
          700: "#b14a2c",
          800: "#913e28",
          900: "#773525",
        },
        secondary: {
          50: "#f0f9f4",
          100: "#dbf0e3",
          200: "#b9e1ca",
          300: "#81b29a",
          400: "#5d9a7c",
          500: "#3d7d62",
          600: "#2c644e",
          700: "#245040",
          800: "#1f4035",
          900: "#1b352d",
        },
        accent: {
          50: "#fefaef",
          100: "#fcf2d0",
          200: "#f8e49e",
          300: "#f2cc8f",
          400: "#ecb75e",
          500: "#e49d38",
          600: "#d0802b",
          700: "#ad6225",
          800: "#8c4e25",
          900: "#734122",
        },
        charcoal: {
          DEFAULT: "#3D405B",
          light: "#575A75",
          lighter: "#8E90A6",
        },
        background: {
          DEFAULT: "#F7F7F5",
          card: "#FFFFFF",
          muted: "#EEEEEB",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        sm: "0.5rem",
        lg: "1rem",
        xl: "1.5rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        dropdown: "0 4px 16px 0 rgb(0 0 0 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
