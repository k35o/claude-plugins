import type { Register } from 'claude-code'

import { refsIn, repoOf } from './external-refs'
import { unsafeReason } from './unsafe-commands'

// どちらのフックにも .catch を付けない。ガードが落ちたときに全ての Bash を止めるより、素通しにするほうを選ぶ。
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
}
