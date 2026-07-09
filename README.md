# claude-plugins

k8o 個人用の Claude Code プラグイン marketplace。グローバルに使う MCP サーバを宣言的に管理する。

## 使い方

任意のマシンで:

```sh
claude plugin marketplace add k35o/claude-plugins
claude plugin install mcp@k8o -s user
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

## 注意

- `fnox` を使う stdio サーバは、`fnox` バイナリと鍵がある自分の端末でのみ点灯する（クラウド/リモート実行環境では動かない）。どこでも使いたいものは http/リモート MCP を優先する。
