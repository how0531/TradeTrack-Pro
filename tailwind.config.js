/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        "barlow-numeric": ["Barlow", "sans-serif"],
      },
      colors: {
        gold: "#C8B085",
        "gold-bg": "#2A2824",
        blue: "#526D82",
        red: "#D05A5A",
        green: "#5B9A8B",
        "bg-dark": "#0B0C10",
        "bg-card": "#141619",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        progress: "progress 1.5s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        progress: {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
}
