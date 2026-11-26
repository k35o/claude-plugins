# claude-plugins

k8o 個人用の Claude Code プラグイン marketplace。

| プラグイン | 内容 |
| --- | --- |
| `mcp` | グローバルに使う MCP サーバを宣言的に管理する |
| `hud` | プロンプト上の帯に、使用上限と日付・時刻・天気を出す |
| `theme` | アプリの色と会話の裏の背景を、k8o.me のダークの見た目にする |
| `guard` | 危険なシェルコマンド、mise で管理していない言語の実行、他のリポジトリへの被リンクになる参照を実行前に拒否し、設定ファイルへの書き込みを人に確認する |
| `practices` | コードを書く、レビューするときの k8o の判断基準を、スキルとして配る |

## 使い方

任意のマシンで:

```sh
claude plugin marketplace add k35o/claude-plugins
claude plugin install mcp@k8o -s user
claude plugin install hud@k8o -s user
claude plugin install theme@k8o -s user
claude plugin install guard@k8o -s user
claude plugin install practices@k8o -s user
```

以後 MCP の増減は [`plugins/mcp/.mcp.json`](plugins/mcp/.mcp.json) を編集して push するだけ。各マシンでは:

```sh
claude plugin marketplace update k8o
```

で反映（Claude の再起動が必要）。

## secrets

秘密は `.mcp.json` に書かず、コマンドを `fnox exec --` でラップして起動時に注入する（機密は `-P bot`）。このリポジトリには秘密を含めないので public で運用できる。

```jsonc
{
  "some-api": { "command": "fnox", "args": ["exec", "--", "some-mcp-server"] }
}
```

## hud

プロンプト上の帯の左に 5時間・7日の使用率とリセット時刻を、右に日付・時刻・天気（今日の最高・最低気温と降水確率つき）を出す。

- 使用率はサブスクリプションで使っているときだけ出る。開いているセッションのどれかが取った一番新しい値を出し、1 分より古くなったら取り直す。
- 天気は [Open-Meteo](https://open-meteo.com/) から 30 分ごとに取る。API キーは要らない。
- 場所は東京駅の緯度経度が既定。設定メニューの `hud` の緯度・経度で変える。

## theme

デスクトップアプリとモバイルアプリを、[k8o.me](https://k8o.me) のダークの見た目にする。

- 色は k8o.me のデザインシステムに合わせる。面はほぼ黒の灰色、文字は白に近い灰色、アクセントはティールにする。
- 会話の裏に、k8o.me のダークの背景を写した絵を描く。ほぼ黒の下地に、上からのティールの淡い光と、右上と右下の隅から流れるクラゲの足の線を重ねる。
- k8o.me では足を左上と右下から流すが、アプリの左上はサイドバーに隠れるので、上の足は左右を反転して右上に置く。
- 有効にしたセッションは、アプリの設定がライトでもダークで表示する。ライトの色は持たない。
- 足の細い線はぼかすと消えるので、背景の上のパネルはぼかさず、不透明度 0.4 のすりガラスにする。
- ターミナルとエディタはテーマを描かないので、何も変わらない。
- テーマはセッションに 1 つなので、ほかのプラグインもテーマを指定すると、後から指定したほうだけが残る。
- `hooks/make-colors.js` は Claude Code が配る色の生成器の写しで、手を入れない。Claude Code を更新したら、plugin-authoring スキルのフォルダから写し直す。

## guard

ツールの呼び出しを実行前に調べ、決まりに当たるものを理由つきで拒否するか、人に確認する。

Bash のコマンドが次のどれかに当たると拒否する。

- `curl … | bash` のように、取得したスクリプトをそのままシェルやインタプリタに渡す
- `chmod 777` や `666`、`o+w` で、誰でも書き込める権限にする
- キーチェーンや `fnox` から秘密の値を出力に読み出す
- `python` や `ruby`、`perl` のような言語のコマンドを、mise で管理していないのに実行する
- `git commit` や `gh pr create` などに渡す文面に、他のリポジトリの Issue や PR への参照（`owner/repo#123` や URL）を含める

次の場所への書き込みは、拒否せずに人に確認する。auto モードでも分類器には任せず、許可を求める窓を出す。

- シェル起動ファイル（`~/.zshrc`、`~/.zshenv`、`~/.config/zsh/` など）と `~/.gitconfig`、`~/.ssh`
- Claude Code の設定（`.claude/settings*.json`）とフック、プラグイン

書き込みは、Bash のリダイレクトと `tee`、Edit と Write で見る。`cp` や `sed -i` での書き込みは見ない。

言語のコマンドは `python`、`pip`、`ruby`、`gem`、`perl` を見て、`mise which` が失敗するものを拒否する。その場所の mise の設定で有効になっていれば通すので、要る言語は mise に足す。`./gen.py` のように直接実行したスクリプトの言語は見ない。

他のリポジトリへの参照は、GitHub が相手のリポジトリに被リンクを残すので拒否する。バッククォートで囲んだ参照はリンクにならないので通す。`--body-file` や `-F <file>` で渡したファイルの中身は見ない。

`/` や `~` の再帰削除は、Claude Code 自身が危険な操作として見ているので、guard では見ない。

コマンドの文字列を正規表現で見るだけなので、すり抜ける書き方はある。コミットメッセージなどの文字列にある `chmod 777` を、誤って拒否することもある。権限の `deny` と `ask` は別に設定しておく。guard が調べている途中で止まったときは、その操作を通さずに人に確認する。

## practices

コードを書く、レビューするときの判断基準をスキルにしたもの。スキル名は `practices:<スキル名>` になる。

| スキル | 使う場面 |
| --- | --- |
| `practices:react` | React のコンポーネントやフックを書く、直す、レビューする |
| `practices:testing` | テストを書く、設計する、レビューする |
| `practices:security` | 変更をレビューする（`/code-review` と `/security-review` を含む）。ハードルールに反する箇所を必ず指摘する |

- スキルは Read、Grep、Glob、Skill しか使えない読み取り専用の環境でも読む。参照はスキルのディレクトリ内の相対パスで書き、`~/.claude` のような利用者の環境を前提にしない。

## 注意

- `fnox` を使う stdio サーバは、`fnox` バイナリと鍵がある自分の端末でのみ点灯する（クラウド/リモート実行環境では動かない）。どこでも使いたいものは http/リモート MCP を優先する。
