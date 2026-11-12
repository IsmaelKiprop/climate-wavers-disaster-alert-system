/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'custom-teal': '#2F4F4F',
        'climate-green': '#067d83',
        'climate-green-dark': '#055a5f',
        'climate-green-light': '#0a9ca3',
        primary: {
          DEFAULT: 'var(--cw-primary)',
          foreground: 'var(--cw-primary-foreground)',
          dark: 'var(--cw-primary-dark)',
        },
        secondary: {
          DEFAULT: 'var(--cw-secondary)',
          foreground: 'var(--cw-secondary-foreground)',
        },
        background: 'var(--cw-background)',
        surface: {
          DEFAULT: 'var(--cw-surface)',
          elevated: 'var(--cw-surface-elevated)',
          muted: 'var(--cw-surface-muted)',
        },
        foreground: 'var(--cw-foreground)',
        muted: 'var(--cw-muted)',
        border: 'var(--cw-border)',
        destructive: 'var(--cw-destructive)',
        warning: 'var(--cw-warning)',
        success: 'var(--cw-success)',
        navbar: 'var(--cw-navbar)',
        sidebar: 'var(--cw-sidebar)',
      },
      borderRadius: {
        DEFAULT: '5px',
        sm: '5px',
        md: '5px',
        lg: '5px',
      },
      backgroundImage: {
        "radial-gradient":
          "radial-gradient(circle, rgba(63,94,251,0.9448967086834734) 0%, rgba(252,70,107,0.2698266806722689) 100%);",
        radial2:
          "radial-gradient(circle, rgba(63,94,251,0.8636642156862745) 17%, rgba(210,70,252,0.4042804621848739) 100%);",
        linear: "linear-gradient(180deg, #067d83 0%, #067d83 100%);",
        bgGradient:
          "linear-gradient(175deg, rgba(34,5,81,1) 17%, rgba(15,2,25,1) 100%)",
      },
      fontFamily: {
        montserrat: ["Montserrat"],
      },
    },
  },
  plugins: [],
};
