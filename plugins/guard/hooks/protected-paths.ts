const WRITE_SHELL_CONFIG =
  'シェル起動ファイル（~/.zshrc、~/.zshenv、~/.config/zsh/ など）や ~/.ssh への書き込みです。自動実行や認証情報の改ざんの経路になり得ます。'
const WRITE_AGENT_CONFIG =
  'Claude Code の設定やフック、プラグイン（.claude/settings*.json、hooks、plugins）への書き込みです。権限やガードを外す経路になり得ます。'

// 同じ対象をシェルの書き込み先と Edit、Write のパスの両方で見るので、正規表現をリテラルで書かずに断片から組み立てる。
const HOME = String.raw`(?:~|\$HOME|\$\{HOME\}|\/root|\/home\/[^/\s]+|\/Users\/[^/\s]+)`
const SHELL_CONFIG = String.raw`\.(?:ssh\/|zshrc|zshenv|zprofile|zlogin|bashrc|bash_profile|bash_login|profile\b|gitconfig|config\/zsh\/)`
const AGENT_CONFIG = String.raw`\.claude\/(?:settings[\w.-]*\.json|hooks\/|plugins\/)`
const REDIRECT = String.raw`(?:>>?|\btee\b(?:\s+-[a-zA-Z]+)*)\s*["']?`

const SHELL_CONFIG_REDIRECT = new RegExp(String.raw`${REDIRECT}${HOME}?\/?${SHELL_CONFIG}`, 'iu')
const AGENT_CONFIG_REDIRECT = new RegExp(String.raw`${REDIRECT}[^\s"'|;&<>]*${AGENT_CONFIG}`, 'u')
const SHELL_CONFIG_FILE = new RegExp(String.raw`^${HOME}\/${SHELL_CONFIG}`, 'iu')
const AGENT_CONFIG_FILE = new RegExp(AGENT_CONFIG, 'u')

const normalized = (path: string) =>
  (path.startsWith('/') ? '/' : '') +
  path
    .split('/')
    .reduce<string[]>(
      (kept, part) =>
        part === '..' ? kept.slice(0, -1) : part === '' || part === '.' ? kept : [...kept, part],
      [],
    )
    .join('/')

const reasonFor = (text: string, shellConfig: RegExp, agentConfig: RegExp) =>
  shellConfig.test(text)
    ? WRITE_SHELL_CONFIG
    : agentConfig.test(text)
      ? WRITE_AGENT_CONFIG
      : undefined

export const protectedRedirectReason = (command: string) =>
  reasonFor(command, SHELL_CONFIG_REDIRECT, AGENT_CONFIG_REDIRECT)

export const protectedFileReason = (path: string) =>
  reasonFor(normalized(path), SHELL_CONFIG_FILE, AGENT_CONFIG_FILE)
