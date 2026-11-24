import type { Register } from 'claude-code'

import { refsIn, repoOf } from './external-refs'
import { protectedFileReason, protectedRedirectReason } from './protected-paths'
import { runtimesIn } from './unmanaged-runtimes'
import { unsafeReason } from './unsafe-commands'

const commandOf = (input: unknown) =>
  typeof input === 'object' &&
  input !== null &&
  'command' in input &&
  typeof input.command === 'string'
    ? input.command
    : ''

const pathOf = (input: unknown) =>
  typeof input === 'object' &&
  input !== null &&
  'file_path' in input &&
  typeof input.file_path === 'string'
    ? input.file_path
    : ''

// 失敗したフックは飛ばされて下の判定がそのまま通るので、調べきれなかった操作は人に確認する。
const askPerson = () =>
  ({
    decision: 'ask',
    reason:
      'guard がこの操作を調べている途中で止まりました。安全かどうかを判定できていないので、内容を確かめてください。',
  }) as const

export const register: Register = on => {
  on('tool.check', { tool: 'Bash' }, (_$, e, next) => {
    const reason = unsafeReason(commandOf(e.input))

    return reason ? { decision: 'deny', reason } : next(e)
  }).catch(askPerson)

  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const refs = refsIn(commandOf(e.input))

    if (refs.length === 0) {
      return next(e)
    }

    const remote = (await $.session.repo())?.remote
    const here = remote ? repoOf(remote) : undefined
    const external = refs.filter(ref => ref.repo !== here).map(ref => ref.text)

    return external.length > 0
      ? {
          decision: 'deny',
          reason: `外部リポジトリの Issue・PR への参照（${external.join('、')}）が含まれています。GitHub が相手のリポジトリに被リンクを残すので、削るか、バッククォートで囲んでオートリンクを止めてください。`,
        }
      : next(e)
  }).catch(askPerson)

  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    // シムはインストール済みの全ての道具にあるので、コマンドの場所ではなく mise which の成否で、ここで有効かを見る。
    const checked = await Promise.all(
      runtimesIn(commandOf(e.input)).map(async bin => ({
        bin,
        isManaged: (await $.process.run(['mise', 'which', bin])).exitCode === 0,
      })),
    )
    const unmanaged = checked.filter(({ isManaged }) => !isManaged).map(({ bin }) => bin)

    return unmanaged.length > 0
      ? {
          decision: 'deny',
          reason: `mise で管理していない言語のコマンド（${unmanaged.join('、')}）を実行しようとしています。スクリプトは mise で管理している node、bun、deno で書いてください。この言語が要るなら、mise に足すかをユーザーに確認してください。`,
        }
      : next(e)
  }).catch(askPerson)

  on('tool.check', { tool: 'Bash' }, (_$, e, next) => {
    const reason = protectedRedirectReason(commandOf(e.input))

    return reason ? { decision: 'ask', reason } : next(e)
  }).catch(askPerson)

  on('tool.check', { tool: ['Edit', 'Write'] }, (_$, e, next) => {
    const reason = protectedFileReason(pathOf(e.input))

    return reason ? { decision: 'ask', reason } : next(e)
  }).catch(askPerson)
}
