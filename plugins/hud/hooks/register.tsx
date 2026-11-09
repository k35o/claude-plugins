import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

type Weather = {
  wmoCode: number
  temperature: number
  isDay: boolean
  high: number
  low: number
  rainChance: number
}

const MINUTE = 60_000
const USAGE_INTERVAL = 5 * MINUTE
const WEATHER_INTERVAL = 30 * MINUTE
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const WINDOWS = ['five_hour', 'seven_day'] as const
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d' }
const BAR_WIDTH = 48
const BAR_HEIGHT = 6

const pad = (n: number) => String(n).padStart(2, '0')

const formatTime = (date: Date) => `${date.getHours()}:${pad(date.getMinutes())}`

const formatDay = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`

const formatNow = (now: Date) =>
  `${formatDay(now)}(${WEEKDAYS[now.getDay()]}) ${formatTime(now)}`

const formatReset = (resetsAt: string, now: Date) => {
  const reset = new Date(resetsAt)

  return reset.toDateString() === now.toDateString()
    ? formatTime(reset)
    : formatDay(reset)
}

const barColor = (percentUsed: number) =>
  percentUsed >= 90 ? '#dc2626' : percentUsed >= 70 ? '#d97706' : '#0d9488'

const barSvg = (percentUsed: number) => {
  const fill = (BAR_WIDTH * Math.min(100, Math.max(0, percentUsed))) / 100
  const radius = BAR_HEIGHT / 2

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_WIDTH}" height="${BAR_HEIGHT}">` +
    `<rect width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="${radius}" fill="#808080" fill-opacity="0.3"/>` +
    `<rect width="${fill}" height="${BAR_HEIGHT}" rx="${radius}" fill="${barColor(percentUsed)}"/>` +
    '</svg>'
  )
}

const weatherEmoji = ({ wmoCode: code, isDay }: Weather) => {
  if (code <= 1) return isDay ? '☀️' : '🌙'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code >= 95) return '⛈️'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️'

  return '🌧️'
}

const parseWeather = (text: string): Weather | undefined => {
  const { current, daily } = JSON.parse(text)
  const weather = {
    wmoCode: current?.weather_code,
    temperature: current?.temperature_2m,
    isDay: current?.is_day === 1,
    high: daily?.temperature_2m_max?.[0],
    low: daily?.temperature_2m_min?.[0],
    rainChance: daily?.precipitation_probability_max?.[0],
  }
  const { isDay, ...numbers } = weather

  return Object.values(numbers).every(value => typeof value === 'number')
    ? weather
    : undefined
}

const parseUsage = (text: string): SessionRateLimit[] => {
  const usage = JSON.parse(text)

  return WINDOWS.flatMap(kind => {
    const window = usage?.[kind]

    if (typeof window?.utilization !== 'number') {
      return []
    }

    return [
      typeof window.resets_at === 'string'
        ? { kind, percentUsed: window.utilization, resetsAt: window.resets_at }
        : { kind, percentUsed: window.utilization },
    ]
  })
}

let weatherUrl = ''
let limits: SessionRateLimit[] = []
let weather: Weather | undefined

// セッションの応答に付く使用率は、他のセッションや端末で使った分が次の応答まで
// 反映されないので、/usage と同じ取得先からアカウント全体の値を取る。
const loadUsage = async ($: EngineInterface) => {
  const authorization = await $.session.authorize()

  if (authorization?.kind !== 'bearer') {
    return
  }

  try {
    const response = await $.http.fetch(USAGE_URL, {
      auth: authorization.handle,
      headers: { 'anthropic-beta': 'oauth-2025-04-20' },
    })

    if (response.ok) {
      limits = parseUsage(response.text)
    }
  } catch {
    return
  }
  $.ui.invalidate('ui.render')
}

const loadWeather = async ($: EngineInterface) => {
  try {
    const response = await $.http.fetch(weatherUrl)
    weather = response.ok ? parseWeather(response.text) : undefined
  } catch {
    weather = undefined
  }
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  weatherUrl =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${options.latitude}&longitude=${options.longitude}` +
    '&current=temperature_2m,weather_code,is_day' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=1'

  on('session.start', async ($, e, next) => {
    const started = await next(e)

    // 毎分の更新を分の変わり目に揃える。
    const now = await $.clock.now()
    $.clock.after(MINUTE - (now % MINUTE), () => {
      $.ui.invalidate('ui.render')
      $.clock.every(MINUTE, () => $.ui.invalidate('ui.render'))
    })
    $.clock.every(USAGE_INTERVAL, () => void loadUsage($))
    $.clock.every(WEATHER_INTERVAL, () => void loadWeather($))
    await Promise.all([loadUsage($), loadWeather($)])

    return started
  })

  on('session.measure', ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      void loadUsage($)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const now = new Date(await $.clock.now())

    // ターミナルは Svg を alt の文字で描くので、そこでだけ Box の背景色でバーを描く。
    const bar = (label: string, percentUsed: number) =>
      e.surface !== 'terminal' && 'Svg' in elements ? (
        <elements.Svg
          source={barSvg(percentUsed)}
          alt={`${label} ${Math.round(percentUsed)}%`}
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
        />
      ) : (
        <Box width={8} height={1} backgroundColor="subtle">
          <Box
            width={`${Math.min(100, Math.round(percentUsed))}%`}
            height={1}
            backgroundColor={barColor(percentUsed)}
          />
        </Box>
      )

    return (
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap="md">
        <Box flexDirection="row" alignItems="center" gap="md">
          {limits.map(({ kind, percentUsed, resetsAt }) => {
            const label = LABELS[kind] ?? kind

            return (
              <Box flexDirection="row" alignItems="center" gap="xs">
                <Text dimColor>{label}</Text>
                {bar(label, percentUsed)}
                <Text tabular>{Math.round(percentUsed)}%</Text>
                {resetsAt && <Text dimColor>{formatReset(resetsAt, now)}</Text>}
              </Box>
            )
          })}
        </Box>
        <Box flexDirection="row" alignItems="center" gap="sm">
          <Text dimColor>{formatNow(now)}</Text>
          {weather && (
            <Box flexDirection="row" alignItems="center" gap="xs">
              <Text>
                {weatherEmoji(weather)} {Math.round(weather.temperature)}°
              </Text>
              <Text dimColor>
                {Math.round(weather.high)}°/{Math.round(weather.low)}°
              </Text>
              <Text dimColor>☂ {weather.rainChance}%</Text>
            </Box>
          )}
        </Box>
      </Box>
    )
  })
}
