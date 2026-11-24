import type { On, ThemeSetArgs } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

import { checkColors } from './make-colors.js'

const SURFACES = ['desktop', 'mobile'] as const

const BACKDROP = {
  plugin: 'theme',
  component: 'Backdrop',
  props: {
    scene: 'jellyfish',
    plugin: 'theme',
    glass: { blur: 0, opacity: 0.4 },
    overrideColorScheme: 'dark',
  },
} as const

const startSession = (on: On) => {
  const themes: ThemeSetArgs[] = []

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('theme.set', (_, e) => {
    themes.push(e)

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })

  return themes
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

test('セッションの開始時に、ダークの表示と、ぼかさない薄いすりガラスの背景を指定する', async ($, on) => {
  const themes = startSession(on)

  await start($)

  expect(
    themes.map(({ backdrop, overrideColorScheme }) => ({
      backdrop,
      overrideColorScheme,
    })),
  ).toEqual([
    {
      backdrop: { scene: 'jellyfish', glass: { blur: 0, opacity: 0.4 } },
      overrideColorScheme: 'dark',
    },
  ])
})

test('アプリの色はダークだけを持ち、面と文字を k8o.me の灰色にする', async ($, on) => {
  const themes = startSession(on)

  await start($)

  const inputs: Record<string, Record<string, unknown>> =
    themes[0]?.colors?.inputs ?? {}

  expect(Object.keys(inputs)).toEqual(['dark'])
  expect({
    page: inputs.dark?.['gray-900'],
    card: inputs.dark?.['gray-800'],
    text: inputs.dark?.['gray-50'],
  }).toEqual({ page: '#111212', card: '#212222', text: '#f6f7f7' })
})

test('指定した色は、どれもデザインシステムのコントラストの基準を満たす', async ($, on) => {
  const themes = startSession(on)

  await start($)

  expect(checkColors(themes[0]?.colors)).toEqual([])
})

test('暗い下地の右上に足 3 本と点 7 つ、右下に足 2 本と点 3 つを、隅に留めて描く', async ($, on) => {
  startSession(on)
  await start($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    const source = String((await ui.find({ type: 'Svg' }))?.props.source)
    const [ground = '', ...corners] = source.split('<svg ').slice(1)

    expect(ground).toContain('fill="#0f1214"')
    expect(
      corners.map(corner => ({
        pinnedTo: corner.match(/preserveAspectRatio="(\w+) meet"/)?.[1],
        legs: count(corner, /<path /g),
        dots: count(corner, /<circle /g),
      })),
    ).toEqual([
      { pinnedTo: 'xMaxYMin', legs: 3, dots: 7 },
      { pinnedTo: 'xMaxYMax', legs: 2, dots: 3 },
    ])
    await ui.unmount()
  }
})

test('ほかのプラグインが指定した背景は描かない', async ($, on) => {
  startSession(on)
  await start($)

  const ui = await $.ui.mount({
    ...BACKDROP,
    props: { ...BACKDROP.props, plugin: 'aquarium' },
    surface: 'desktop',
  })

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})
