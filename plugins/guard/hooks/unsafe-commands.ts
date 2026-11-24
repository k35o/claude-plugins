type Rule = { pattern: RegExp; reason: string }

const RULES: Rule[] = [
  {
    // プログラムをインラインで渡したインタプリタ（python -m、node -e）はパイプからデータを読むだけなので、拒否から外す。
    pattern:
      /\b(?:curl|wget|fetch)\b[^\n;&]*?\|\s*(?:sudo\s+(?:-\S+\s+)*)?(?:\S*\/)?(?:(?:sh|bash|zsh|dash|ksh)\b|(?:python3?|node|perl|ruby)\b(?!\s+-\w*[cemp]))/iu,
    reason:
      'リモートのスクリプトをパイプで直接シェルやインタプリタに渡しています（curl | bash 型）。一旦ファイルに保存し、内容を確認してから実行してください。',
  },
  {
    pattern:
      /\b(?:eval|source|sh|bash|zsh|dash|ksh)\b[^\n;&|]*?(?:\$\(|<\()\s*(?:curl|wget|fetch)\b/iu,
    reason:
      'eval・sh -c "$(curl …)"・<(curl …) でリモート取得したコードを実行しようとしています。一旦ファイルに保存し、内容を確認してから実行してください。',
  },
  {
    pattern:
      /\bchmod\b\s+(?:-[a-zA-Z]+\s+)*(?:[0-7]{0,3}[2367]\b|(?:[ugoa]*[-+=][rwxXst]*,)*[ugoa]*[oa][ugoa]*[+=][rwxXst]*w)/u,
    reason:
      'chmod で誰でも書き込める権限（777、666、o+w など）にしようとしています。必要最小の権限（例: 644 / 755）を指定してください。',
  },
  {
    pattern:
      /(?:>>?|\btee\b(?:\s+-[a-zA-Z]+)*)\s*["']?(?:~|\$HOME|\$\{HOME\}|\/root|\/home\/[^/\s]+|\/Users\/[^/\s]+)?\/?\.(?:ssh\/|zshrc|zshenv|zprofile|zlogin|bashrc|bash_profile|bash_login|profile\b|gitconfig|config\/zsh\/)/iu,
    reason:
      'シェル起動ファイル（~/.zshrc・~/.zshenv・~/.config/zsh/ など）や ~/.ssh に書き込もうとしています。自動実行や認証情報の改ざん経路になり得ます。',
  },
  {
    pattern:
      /(?:>>?|\btee\b(?:\s+-[a-zA-Z]+)*)\s*["']?[^\s"'|;&<>]*\.claude\/(?:settings[\w.-]*\.json|hooks\/|plugins\/)/u,
    reason:
      'Claude Code の設定やフック、プラグイン（.claude/settings*.json・hooks・plugins）にシェルから書き込もうとしています。権限やガードを外す経路になり得ます。変更が必要ならユーザーに確認してください。',
  },
  {
    pattern:
      /\bsecurity\s+(?:find-(?:generic|internet)-password\b[^\n|;&]*\s-[a-zA-Z]*[wg]\b|dump-keychain\b[^\n|;&]*\s-[a-zA-Z]*d\b|export\b)|\bfnox(?:\s+(?:-[a-zA-Z]\s+\S+|--[\w-]+(?:[=\s]\S+)?|-\w+))*\s+(?:get|export|ex|env)\b/u,
    reason:
      'キーチェーンや fnox から秘密の値を出力に読み出そうとしています。値は fnox exec -P <profile> -- <command> で必要なコマンドにだけ渡してください。',
  },
]

export const unsafeReason = (command: string) =>
  RULES.find(rule => rule.pattern.test(command))?.reason
