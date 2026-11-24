import type { Register } from 'claude-code'

import { COLORS } from './colors'
import { JELLYFISH_SVG } from './jellyfish'

const SCENE = 'jellyfish'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    // 足の細い線はぼかすと消えるので、パネルのすりガラスをぼかさない。
    await $.theme.set({
      colors: COLORS,
      backdrop: { scene: SCENE, glass: { blur: 0, opacity: 0.4 } },
      overrideColorScheme: 'dark',
    })

    return started
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE) {
      return next(e)
    }

    const elements = $.ui.resolve(e)

    return 'Svg' in elements ? (
      <elements.Svg
        source={JELLYFISH_SVG}
        alt="隅からクラゲの足が流れる暗い背景"
      />
    ) : (
      next(e)
    )
  })
}
