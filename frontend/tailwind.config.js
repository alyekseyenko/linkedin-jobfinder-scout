/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Bio-Neon 2026 Palette
        bio: {
          void: "#030008",
          neon: {
            green: "#00ff80",
            blue: "#00d4ff",
            purple: "#bc13fe",
            cyan: "#00fff9",
          },
          glass: {
            DEFAULT: "rgba(255, 255, 255, 0.03)",
            hover: "rgba(255, 255, 255, 0.08)",
            border: "rgba(255, 255, 255, 0.05)",
          },
          mesh: {
            1: "#0a0a2e",
            2: "#1a0b2e",
            3: "#0b1a2e",
          }
        },
        razer: {
          green: {
            50: "#f0fdf4",
            100: "#dcfce7",
            200: "#bbf7d0",
            300: "#86efac",
            400: "#4ade80",
            500: "#22c55e",
            600: "#16a34a",
            700: "#15803d",
            800: "#166534",
            900: "#14532d",
            950: "#052e16",
          },
          neon: {
            green: "#00ff41",
            bright: "#39ff14",
            dark: "#00cc33",
          }
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "3xl": "2rem",
        "4xl": "3rem",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Geist", "sans-serif"],
      },
      keyframes: {
        "mesh-float": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
        },
        "grain": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-5%, -10%)" },
          "20%": { transform: "translate(-15%, 5%)" },
          "30%": { transform: "translate(7%, -25%)" },
          "40%": { transform: "translate(-5%, 25%)" },
          "50%": { transform: "translate(-15%, 10%)" },
          "60%": { transform: "translate(15%, 0%)" },
          "70%": { transform: "translate(0%, 15%)" },
          "80%": { transform: "translate(3%, 35%)" },
          "90%": { transform: "translate(-10%, 10%)" },
        },
        "neural-chase": {
          "0%": { left: "-100%" },
          "100%": { left: "100%" }
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        }
      },
      animation: {
        "mesh-float": "mesh-float 20s infinite ease-in-out",
        "mesh-float-slow": "mesh-float 35s infinite ease-in-out",
        "mesh-float-reverse": "mesh-float 25s infinite ease-in-out reverse",
        "grain": "grain 8s steps(10) infinite",
        "slide-up": "slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      boxShadow: {
        "bio-neon": "0 0 20px rgba(0, 255, 128, 0.2), 0 0 40px rgba(0, 255, 128, 0.1)",
        "bio-cyan": "0 0 20px rgba(0, 255, 249, 0.2), 0 0 40px rgba(0, 255, 249, 0.1)",
        "bio-glass": "0 8px 32px 0 rgba(0, 0, 0, 0.8)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
