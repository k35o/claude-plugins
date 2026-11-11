type Ref = { repo: string; text: string }

const WRITES_TO_GITHUB =
  /\bgit\b(?:\s+-C\s+\S+)?\s+commit\b|\bgh\s+(?:pr\s+(?:create|edit|comment)|issue\s+(?:create|edit|comment))\b/u

// バッククォートで囲んだ参照は GitHub がリンクにしないので、どちらのパターンも拾わない。
const SHORT_REF = /(?<![\w.`/-])([\w.-]+\/[\w.-]+)#\d+(?![\w`])/gu
const URL_REF =
  /(?<!`)https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/\d+(?![\w`])/gu

export const repoOf = (remote: string) =>
  /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/u.exec(remote)?.[1]?.toLowerCase()

export const refsIn = (command: string): Ref[] =>
  WRITES_TO_GITHUB.test(command)
    ? [SHORT_REF, URL_REF].flatMap(pattern =>
        [...command.matchAll(pattern)].map(([text, repo = '']) => ({
          repo: repo.toLowerCase(),
          text,
        })),
      )
    : []
