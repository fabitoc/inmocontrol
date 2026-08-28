/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#09090B",
        surface: "#0F172A",
        border: "#1E293B",
        "border-subtle": "#1E293B",
        "text-primary": "#F8FAFC",
        "text-muted": "#94A3B8",
        "accent-primary": "#D97706",
        "accent-hover": "#B45309",
        "accent-subtle": "#78350F",
        "status-danger": "#EF4444",
        "status-success": "#10B981",
        // Extended Fluent Dark palette
        dark: {
          950: "#09090B", // canvas
          900: "#0F172A", // surface
          800: "#1E293B", // border/card header
          700: "#334155", // hover border
        },
        amber: {
          600: "#D97706",
          700: "#B45309",
          900: "#78350F",
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
