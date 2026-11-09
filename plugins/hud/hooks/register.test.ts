import type { HttpResponse, On, SessionRateLimit } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// 実行環境のタイムゾーンに依らず、ローカル時刻で書いた値がそのまま表示されることを確かめる。
const local = (month: number, day: number, hours: number, minutes: number) =>
  new Date(2026, month - 1, day, hours, minutes)

const NOW = local(11, 9, 14, 32).getTime()

const LIMITS: SessionRateLimit[] = [
  { kind: 'five_hour', percentUsed: 42.4, resetsAt: local(11, 9, 16, 0).toISOString() },
  { kind: 'seven_day', percentUsed: 88, resetsAt: local(11, 14, 9, 5).toISOString() },
]

const BAND = {
  plugin: 'hud',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 4,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 4 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop'] as const

const TEAL = '#0d9488'
const AMBER = '#d97706'
const RED = '#dc2626'

const weatherResponse = (current: unknown, daily: unknown): { value: HttpResponse } => ({
  value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ current, daily }) },
})

const TODAY = {
  temperature_2m_max: [20.4],
  temperature_2m_min: [9.4],
  precipitation_probability_max: [30],
}

const SUNNY = () =>
  weatherResponse({ weather_code: 0, temperature_2m: 18.4, is_day: 1 }, TODAY)

const startSession = (on: On, weather: () => { value: HttpResponse }) => {
  const clock = mock.clock(on, { now: NOW })

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200_000 }, rateLimits: LIMITS },
  }))
  on('http.fetch', weather)

  return clock
}

test('帯の左に使用率とリセットを出し、今日のリセットは時刻、明日以降は日付にする', async ($, on) => {
  startSession(on, SUNNY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(text => text.text)

    expect(texts.slice(0, 6)).toEqual(['5h', '42%', '16:00', '7d', '88%', '11/14'])
    await ui.unmount()
  }
})

test('Desktop ではバーを Svg で、使用率が70%以上なら警告色、90%以上ならエラー色で描く', async ($, on) => {
  startSession(on, SUNNY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { window: 200_000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 69 },
      { kind: 'seven_day', percentUsed: 70 },
      { kind: 'spend_limit', percentUsed: 90 },
    ],
    changed: ['rateLimits'],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const bars = await ui.findAll({ type: 'Svg' })

  expect(bars.map(bar => bar.props.alt)).toEqual(['5h 69%', '7d 70%', 'spend_limit 90%'])
  expect(bars.map(bar => String(bar.props.source).match(/#[0-9a-f]{6}(?="\/><\/svg>)/)?.[0])).toEqual([
    TEAL,
    AMBER,
    RED,
  ])
  await ui.unmount()
})

test('ターミナルではバーを Box の背景色で描く', async ($, on) => {
  startSession(on, SUNNY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const fills = (await ui.findAll({ type: 'Box' }))
    .map(box => box.props)
    .filter(props => props.backgroundColor !== undefined && props.backgroundColor !== 'subtle')

  expect(fills).toEqual([
    expect.objectContaining({ width: '42%', backgroundColor: TEAL }),
    expect.objectContaining({ width: '88%', backgroundColor: AMBER }),
  ])
  await ui.unmount()
})

test('帯の右に日付・曜日・時刻と、天気・今日の最高最低気温・降水確率を出す', async ($, on) => {
  startSession(on, SUNNY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(text => text.text)

    expect(texts.slice(-4)).toEqual(['11/9(月) 14:32', '☀️ 18°', '20°/9°', '☂ 30%'])
    await ui.unmount()
  }
})

test('夜の晴れは月、雪のコードは雪で出す', async ($, on) => {
  let current = { weather_code: 1, temperature_2m: 3, is_day: 0 }
  const clock = startSession(on, () => weatherResponse(current, TODAY))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const night = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await night.find({ type: 'Text', text: /3°$/ }))?.text).toBe('🌙 3°')
  await night.unmount()

  current = { weather_code: 73, temperature_2m: -1, is_day: 1 }
  await clock.advance(30 * 60_000)

  const snow = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await snow.find({ type: 'Text', text: /-1°$/ }))?.text).toBe('❄️ -1°')
  await snow.unmount()
})

test('分が変わったら帯の時刻を進める', async ($, on) => {
  const clock = startSession(on, SUNNY)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await clock.advance(60_000)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /14:33/ }))?.text).toBe('11/9(月) 14:33')
  await ui.unmount()
})

test('天気が取れなければ天気を出さず、日付と時刻は出す', async ($, on) => {
  startSession(on, () => ({
    value: { status: 503, ok: false, headers: {}, text: '' },
  }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /14:32/ }))?.text).toBe('11/9(月) 14:32')
  expect(await ui.find({ type: 'Text', text: /°/ })).toBeUndefined()
  await ui.unmount()
})
