import {
  defineConfig,
  presetUno,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
  ],
  theme: {
    colors: {
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        500: '#0ea5e9',
        600: '#0284c7',
      },
    },
    breakpoints: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
    },
  },
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
    'container': 'w-full mx-auto px-4',
    'btn': 'px-4 py-2 rounded-lg cursor-pointer',
    'btn-primary': 'btn bg-primary-500 text-white hover:bg-primary-600',
    'input': 'w-full px-4 py-2 rounded-lg border outline-none',
  },
}) 