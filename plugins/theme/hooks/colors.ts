import { makeColors } from './make-colors.js'

// makeColors は 6 桁の 16 進しか受けないので、k8o.me のデザインシステムが OKLCH で持つ値を sRGB に直して書く。
const GRAY_50 = '#f6f7f7'
const GRAY_300 = '#c8cbcd'
const GRAY_400 = '#abaeb1'
const GRAY_900 = '#212222'
const GRAY_950 = '#111212'
const TEAL_500 = '#06a995'
const RED_400 = '#ff847d'
const RED_500 = '#ff4044'
const GREEN_500 = '#04af51'
const YELLOW_500 = '#b28d04'
const PURPLE_500 = '#b461ff'

export const { theme: COLORS } = makeColors({
  label: 'k8o',
  only: 'dark',
  roles: {
    accent: TEAL_500,
    danger: RED_500,
    success: GREEN_500,
    warning: YELLOW_500,
    pro: PURPLE_500,
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': GRAY_950,
        'surface-1': GRAY_900,
        // k8o.me のカードは gray-800 だが、その明るさでは状態の色の文字がコントラストの基準を割るので、gray-900 に留める。
        'surface-2': GRAY_900,
        'surface-3': GRAY_900,
        'text-primary': GRAY_50,
        'text-secondary': GRAY_300,
        'text-muted': GRAY_400,
      },
    },
    // danger の red-500 から作られる差分の赤は、面の上でコントラストの基準を割る。
    git: { removed: RED_400, closed: RED_400 },
  },
})
