export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef4fb',
          100: '#d9e5f5',
          200: '#b3c9e8',
          300: '#7fa4d6',
          400: '#4a7fc3',
          500: '#1e5aa8',   // Navy chính
          600: '#174585',   // Navy đậm
          700: '#0f3162',   // Navy tối
          800: '#0a2244',
          900: '#061628'
        },
        success: '#15803d',
        warning: '#b45309',
        danger:  '#b91c1c',
        info:    '#0369a1'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'base': ['16px', { lineHeight: '1.6' }],
        'lg':   ['18px', { lineHeight: '1.6' }]
      }
    }
  },
  plugins: []
};