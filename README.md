# claude-plugins

k8o 個人用の Claude Code プラグイン marketplace。

| プラグイン | 内容 |
| --- | --- |
| `mcp` | グローバルに使う MCP サーバを宣言的に管理する |
| `hud` | プロンプト上の帯に、使用上限と日付・時刻・天気を出す |
| `theme` | アプリの色と会話の裏の背景を、k8o.me のダークの見た目にする |

## 使い方

任意のマシンで:

```sh
claude plugin marketplace add k35o/claude-plugins
claude plugin install mcp@k8o -s user
claude plugin install hud@k8o -s user
claude plugin install theme@k8o -s user
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

## 注意

- `fnox` を使う stdio サーバは、`fnox` バイナリと鍵がある自分の端末でのみ点灯する（クラウド/リモート実行環境では動かない）。どこでも使いたいものは http/リモート MCP を優先する。
