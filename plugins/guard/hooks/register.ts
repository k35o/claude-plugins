import type { Register } from 'claude-code'

import { refsIn, repoOf } from './external-refs'
import { runtimesIn } from './unmanaged-runtimes'
import { unsafeReason } from './unsafe-commands'

// どのフックにも .catch を付けない。ガードが落ちたときに全ての Bash を止めるより、素通しにするほうを選ぶ。
export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    const reason = unsafeReason(e.command)

    return reason ? { deny: `${$.plugin.name}: ${reason}` } : next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const refs = refsIn(e.command)

    if (refs.length === 0) {
      return next(e)
    }

    const remote = (await $.session.repo())?.remote
    const here = remote ? repoOf(remote) : undefined
    const external = refs.filter(ref => ref.repo !== here).map(ref => ref.text)

    return external.length > 0
      ? {
          deny: `${$.plugin.name}: 外部リポジトリの Issue・PR への参照（${external.join('、')}）が含まれています。GitHub が相手のリポジトリに被リンクを残すので、削るか、バッククォートで囲んでオートリンクを止めてください。`,
        }
      : next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    // シムはインストール済みの全ての道具にあるので、コマンドの場所ではなく mise which の成否で、ここで有効かを見る。
    const checked = await Promise.all(
      runtimesIn(e.command).map(async bin => ({
        bin,
        isManaged: (await $.process.run(['mise', 'which', bin])).exitCode === 0,
      })),
    )
    const unmanaged = checked.filter(({ isManaged }) => !isManaged).map(({ bin }) => bin)

    return unmanaged.length > 0
      ? {
          deny: `${$.plugin.name}: mise で管理していない言語のコマンド（${unmanaged.join('、')}）を実行しようとしています。スクリプトは mise で管理している node、bun、deno で書いてください。この言語が要るなら、mise に足すかをユーザーに確認してください。`,
        }
      : next(e)
  })
}
