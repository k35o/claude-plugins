import type { HttpResponse, On, SessionAuthorization } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

// 実行環境のタイムゾーンに依らず、ローカル時刻で書いた値がそのまま表示されることを確かめる。
const local = (month: number, day: number, hours: number, minutes: number) =>
  new Date(2026, month - 1, day, hours, minutes)

const NOW = local(11, 9, 14, 32).getTime()
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'

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

const ok = (body: unknown): { value: HttpResponse } => ({
  value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) },
})

const unavailable = (): { value: HttpResponse } => ({
  value: { status: 503, ok: false, headers: {}, text: '' },
})

const window = (utilization: number, resetsAt: Date | null = null) => ({
  utilization,
  resets_at: resetsAt?.toISOString() ?? null,
})

const USAGE = {
  five_hour: window(42.4, local(11, 9, 16, 0)),
  seven_day: window(88, local(11, 14, 9, 5)),
  seven_day_opus: null,
}

const TODAY = {
  temperature_2m_max: [20.4],
  temperature_2m_min: [9.4],
  precipitation_probability_max: [30],
}

const SUNNY = { weather_code: 0, temperature_2m: 18.4, is_day: 1 }

type Answer = { value: HttpResponse } | Promise<{ value: HttpResponse }>

type World = {
  usage?: () => Answer
  weather?: () => Answer
  authorization?: SessionAuthorization
}

const startSession = (on: On, world: World = {}) => {
  const clock = mock.clock(on, { now: NOW })
  const requests: { url: string; headers?: Record<string, string>; auth?: string }[] = []
  const usage = world.usage ?? (() => ok(USAGE))
  const weather = world.weather ?? (() => ok({ current: SUNNY, daily: TODAY }))
  // ほかのセッションと共有する store の中身をテストから読み書きするため、mock.store ではなく素のオブジェクトで持つ。
  const store: Record<string, unknown> = {}

  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => {
    store[e.key] = JSON.parse(JSON.stringify(e.value))

    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.authorize', () => ({
    value:
      world.authorization === undefined
        ? { handle: 'session-credential', kind: 'bearer' }
        : world.authorization,
  }))
  on('http.fetch', (_, e) => {
    requests.push({ url: e.url, headers: e.init?.headers, auth: e.init?.auth })

    return e.url === USAGE_URL ? usage() : weather()
  })

  return { clock, requests, store }
}

const start = ($: Engine) =>
  $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

const bandTexts = async ($: Engine) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const texts = (await ui.findAll({ type: 'Text' })).map(text => text.text)
  await ui.unmount()

  return texts
}

const measureRateLimits = ($: Engine, rateLimits: { kind: string; percentUsed: number }[]) =>
  $.session.measure({ context: { window: 200_000 }, rateLimits, changed: ['rateLimits'] })

test('帯の左に、/usage と同じ取得先から取った使用率とリセットを出す', async ($, on) => {
  const { requests } = startSession(on)
  await start($)

  expect(requests.find(request => request.url === USAGE_URL)).toEqual({
    url: USAGE_URL,
    headers: { 'anthropic-beta': 'oauth-2025-04-20' },
    auth: 'session-credential',
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(text => text.text)

    expect(texts.slice(0, 6)).toEqual(['5h', '42%', '16:00', '7d', '88%', '11/14'])
    await ui.unmount()
  }
})

test('使用率は1分ごとに取り直し、70%以上は警告色、90%以上はエラー色で描く', async ($, on) => {
  let usage: unknown = { five_hour: window(69), seven_day: window(70) }
  const { clock } = startSession(on, { usage: () => ok(usage) })
  await start($)

  const colors = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const bars = await ui.findAll({ type: 'Svg' })
    await ui.unmount()

    return bars.map(bar => String(bar.props.source).match(/#[0-9a-f]{6}(?="\/><\/svg>)/)?.[0])
  }

  expect(await colors()).toEqual([TEAL, AMBER])

  usage = { five_hour: window(69), seven_day: window(90) }
  await clock.advance(60_000)

  expect(await colors()).toEqual([TEAL, RED])
})

test('このセッションの応答で使用率が動いたら、その場で取り直す', async ($, on) => {
  let usage: unknown = USAGE
  const { clock } = startSession(on, { usage: () => ok(usage) })
  await start($)

  usage = { five_hour: window(100), seven_day: window(17) }
  await clock.advance(10_000)
  await measureRateLimits($, [{ kind: 'five_hour', percentUsed: 93 }])
  await clock.settle()

  expect((await bandTexts($)).slice(0, 4)).toEqual(['5h', '100%', '7d', '17%'])
})

test('このセッションの応答で使用率が動いて取り直せなければ、応答に付いてきた使用率を出す', async ($, on) => {
  let isUp = true
  const { clock } = startSession(on, { usage: () => (isUp ? ok(USAGE) : unavailable()) })
  await start($)

  isUp = false
  await clock.advance(10_000)
  await measureRateLimits($, [
    { kind: 'seven_day', percentUsed: 89 },
    { kind: 'five_hour', percentUsed: 47.5 },
  ])
  await clock.settle()

  expect((await bandTexts($)).slice(0, 4)).toEqual(['5h', '48%', '7d', '89%'])
})

test('取り直しに失敗したら、前に取れた使用率を出し続ける', async ($, on) => {
  let isUp = true
  const { clock } = startSession(on, { usage: () => (isUp ? ok(USAGE) : unavailable()) })
  await start($)

  isUp = false
  await clock.advance(5 * 60_000)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: '42%' }))?.text).toBe('42%')
  await ui.unmount()
})

test('セッションを開いたときに取れなくても、1分後に取り直して出す', async ($, on) => {
  let isUp = false
  const { clock } = startSession(on, { usage: () => (isUp ? ok(USAGE) : unavailable()) })
  await start($)

  isUp = true
  await clock.advance(60_000)

  expect((await bandTexts($)).slice(0, 6)).toEqual(['5h', '42%', '16:00', '7d', '88%', '11/14'])
})

test('先に出した取り直しが後から返っても、新しい使用率を古い値で上書きしない', async ($, on) => {
  let respond = (): Answer => ok(USAGE)
  const { clock } = startSession(on, { usage: () => respond() })
  await start($)

  respond = async () => {
    await clock.sleep(10_000)

    return ok({ five_hour: window(50), seven_day: window(90) })
  }
  await clock.advance(60_000)

  respond = () => ok({ five_hour: window(60), seven_day: window(91) })
  await clock.advance(1_000)
  await measureRateLimits($, [{ kind: 'five_hour', percentUsed: 60 }])
  await clock.advance(10_000)

  expect((await bandTexts($)).slice(0, 4)).toEqual(['5h', '60%', '7d', '91%'])
})

test('取った使用率は、ほかのセッションが読めるように保存する', async ($, on) => {
  const { store } = startSession(on)
  await start($)

  expect(store.usage).toEqual({
    limits: [
      { kind: 'five_hour', percentUsed: 42.4, resetsAt: local(11, 9, 16, 0).toISOString() },
      { kind: 'seven_day', percentUsed: 88, resetsAt: local(11, 14, 9, 5).toISOString() },
    ],
    at: NOW,
  })
})

test('ほかのセッションが保存した新しい使用率は、取りに行かずに1分以内に出す', async ($, on) => {
  const { clock, requests, store } = startSession(on)
  await start($)

  store.usage = {
    limits: [
      { kind: 'five_hour', percentUsed: 77 },
      { kind: 'seven_day', percentUsed: 90 },
    ],
    at: NOW + 30_000,
  }
  await clock.advance(60_000)

  expect((await bandTexts($)).slice(0, 4)).toEqual(['5h', '77%', '7d', '90%'])
  expect(requests.filter(request => request.url === USAGE_URL)).toHaveLength(1)
})

test('サブスクリプションの認証がなければ使用率を取りに行かない', async ($, on) => {
  const { requests } = startSession(on, {
    authorization: { handle: 'api-key-credential', kind: 'api-key' },
  })
  await start($)

  expect(requests.map(request => request.url)).not.toContain(USAGE_URL)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.findAll({ type: 'Svg' })).toEqual([])
  await ui.unmount()
})

test('ターミナルではバーを Box の背景色で描く', async ($, on) => {
  startSession(on)
  await start($)

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
  startSession(on)
  await start($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const texts = (await ui.findAll({ type: 'Text' })).map(text => text.text)

    expect(texts.slice(-4)).toEqual(['11/9(月) 14:32', '☀️ 18°', '20°/9°', '☂ 30%'])
    await ui.unmount()
  }
})

test('夜の晴れは月、雪のコードは雪で出す', async ($, on) => {
  let current = { weather_code: 1, temperature_2m: 3, is_day: 0 }
  const { clock } = startSession(on, { weather: () => ok({ current, daily: TODAY }) })
  await start($)

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
  const { clock } = startSession(on)
  await start($)

  await clock.advance(60_000)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /14:33/ }))?.text).toBe('11/9(月) 14:33')
  await ui.unmount()
})

test('天気が取れなければ天気を出さず、日付と時刻は出す', async ($, on) => {
  startSession(on, { weather: unavailable })
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /14:32/ }))?.text).toBe('11/9(月) 14:32')
  expect(await ui.find({ type: 'Text', text: /°/ })).toBeUndefined()
  await ui.unmount()
})
