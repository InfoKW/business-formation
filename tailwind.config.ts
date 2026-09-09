import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        kw: {
          forest:       '#122620',
          'forest-light': '#1E4A38',
          'forest-deep':  '#0A1A15',
          gold:         '#C3A862',
          'gold-light': '#D4BA7A',
          'gold-dark':  '#A88640',
          cream:        '#FFF7ED',
          'bg-secondary': '#F0F2F4',
          'border-light': '#DEDEDE',
          'border-mid':   '#E3E3E3',
          'text-primary':   '#1A1A1A',
          'text-secondary': '#484848',
          'text-muted':     '#767676',
        },
      },
      fontFamily: {
        primary:   ['Source Sans 3', 'myriad-pro', 'Arial', 'sans-serif'],
        secondary: ['Questrial', 'sans-serif'],
        display:   ['Marcellus', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '8px',
        pill: '99px',
      },
      boxShadow: {
        hover: '0px 6px 24px 0px rgba(18, 38, 32, 0.14)',
      },
    },
  },
  plugins: [],
}

export default config
