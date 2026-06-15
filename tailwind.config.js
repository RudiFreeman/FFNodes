/** @type {import('tailwindcss').Config} */
// Конфиг Tailwind. Палитра — из docs/UI.md (Developer Tool / IDE, dark).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Семантические токены приложения (см. docs/UI.md §2)
        bg: "#0F172A",          // фон приложения (slate-900)
        surface: "#1B2336",     // панели, карточки
        "surface-2": "#272F42", // вложенные блоки, hover-фон
        border: "#475569",      // границы (slate-600)
        fg: "#F8FAFC",          // основной текст (slate-50)
        "fg-muted": "#94A3B8",  // вторичный текст (slate-400)
        primary: "#1E293B",     // базовые контролы (slate-800)
        accent: "#22C55E",      // CTA «Render», успех (green-500)
        "on-accent": "#0F172A", // текст на акценте
        destructive: "#EF4444", // удаление, ошибки (red-500)
        // Цвета нод по типу (см. docs/UI.md §2)
        "node-input": "#3B82F6",
        "node-filter": "#8B5CF6",
        "node-output": "#22C55E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
