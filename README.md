# claude-plugins

k8o 個人用の Claude Code プラグイン marketplace。

| プラグイン | 内容 |
| --- | --- |
| `mcp` | グローバルに使う MCP サーバを宣言的に管理する |
| `hud` | プロンプト上の帯に、使用上限と日付・時刻・天気を出す |

## 使い方

任意のマシンで:

```sh
claude plugin marketplace add k35o/claude-plugins
claude plugin install mcp@k8o -s user
claude plugin install hud@k8o -s user
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

- 使用率はサブスクリプションで使っているときだけ出る。セッションを開いた直後は、最初の応答が返るまで出ない。
- 天気は [Open-Meteo](https://open-meteo.com/) から 30 分ごとに取る。API キーは要らない。
- 場所は東京駅の緯度経度が既定。設定メニューの `hud` の緯度・経度で変える。

## 注意

- `fnox` を使う stdio サーバは、`fnox` バイナリと鍵がある自分の端末でのみ点灯する（クラウド/リモート実行環境では動かない）。どこでも使いたいものは http/リモート MCP を優先する。
