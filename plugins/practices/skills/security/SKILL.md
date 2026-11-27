---
name: security
description: 変更やPRをレビューするときに使う。`/code-review`や`/security-review`を含むレビューでは必ず読み、ハードルールに反する箇所を指摘する。「レビューして」「このPR大丈夫？」「セキュリティを見て」と言われたときや、Server Functions、Route Handlers、認証、キャッシュ、依存、GitHub Actionsに触れるコードを書くときにも使う。
---

# Security

セキュリティに関わる変更をレビューするときに参照する脅威モデル。

---

## スタックと前提

- TypeScript（strict 前提）、React / Next.js（App Router / RSC / Server Functions）
- ランタイムは Node.js（Edge 含む）
- pnpm、oxc-config 系のツールチェイン
- ライト UI 重視、Server Functions と Route Handlers が主な攻撃面

## 高優先で見るべき場所

- `'use server'` を含むファイルと、`'use server'` を書いたインライン関数：Server Functions のエントリ。export したものはすべて直接 POST で呼べる
- `app/**/route.ts`：Route Handlers
- `proxy.ts`（Next.js 15 までの `middleware.ts`）：全リクエストに乗るが、楽観的なチェック専用
- `'use cache'` を使う関数：別のユーザーにキャッシュが漏れる
- `.github/workflows/**`：リポジトリ全体の CI 権限に効く
- `next.config.*`：`images.remotePatterns`・`images.dangerouslyAllowLocalIP`・`images.dangerouslyAllowSVG`・`serverActions.allowedOrigins`・`headers()`・`rewrites()`
- `auth.ts` / 認証コールバック実装
- `package.json`・`pnpm-workspace.yaml`・lockfile：サプライチェーンの入口

---

## ハードルール（違反は必ず指摘）

### シークレットと設定

- `.env*` を含む変更は指摘する（コミット禁止）
- `NEXT_PUBLIC_*` はクライアントに出る。秘密値・API キー・PII を絶対に置かない
- トークン比較は `crypto.timingSafeEqual` などの定数時間比較。`===` は不可
- ハードコードされた API キー（`sk_live_`、`AKIA`、Slack `xoxb-` など）禁止。Server Functions の中も同じ（ソースがクライアントに漏れた脆弱性がある）
- Server Functions の戻り値はクライアントにシリアライズされる。DB の行をそのまま返さず、必要なフィールドだけの DTO にする

### 入力検証

- Server Functions と Route Handlers のエントリで、業務ロジックより前に zod 等のスキーマ検証を通す（引数はクライアントが自由に組み立てられる）
- ユーザー入力をファイルパスに使うとき、`path.relative` でディレクトリエスケープ（`..`）が
  ないか確認
- SQL は必ずパラメタライズドクエリ／プリペアドステートメント／ORM 経由。文字列連結禁止
- shell コマンド：`child_process.exec`/`execSync` でユーザー入力を渡さない。`execFile`/
  `spawn` に引数配列で渡す形にする

### 認可

- Server Functions と Route Handlers は、それぞれの関数の中でセッションを取得して認可する
- 認可が `proxy.ts` や layout にしかないのは HIGH。proxy は迂回される脆弱性が繰り返し出ており、layout はクライアント側の遷移で再実行されない
- リソース所有チェック（IDOR 防止）：ID から引いたレコードが「ログインユーザーのものか」
  を都度確認する
- 管理者専用のパスは `requireRole("admin")` 等のチェックを必ず通す

### キャッシュ

- `'use cache'` の関数でユーザーごとのデータを扱うときは、サーバー側で解決したユーザー ID をキャッシュのキーに含める。クライアントから受け取った `userId` を引数に取るキャッシュ関数を export しない
- キャッシュ関数の引数や `cacheTag` に秘密や PII を入れない（キャッシュのキーとして保存される）

### 依存とサプライチェーン

- `next`・`react`・`react-server-dom-*` が、使っているメジャーの最新のセキュリティリリースより古いのは HIGH。RSC の RCE などの深刻な修正が続いており、サポートの終わったメジャーには修正が出ない
- pnpm の `allowBuilds` への追加、`dangerouslyAllowAllBuilds`、`minimumReleaseAge` を下げる変更、`blockExoticSubdeps`・`trustPolicy` を外す変更は指摘する（インストール時のスクリプトで広がるワームが続いている）
- git リポジトリや tarball の URL を指す依存の追加は指摘する

### DOM / React

- `dangerouslySetInnerHTML` は禁止。例外は DOMPurify などで明示的に sanitize した HTML のみ
- `.innerHTML =`、`document.write` 禁止
- `<a href={...}>` にユーザー入力 URL を渡す場合は `javascript:` スキームを弾く
- `eval`、`new Function(...)` 禁止

### 暗号

- 自前暗号は書かない。`crypto.subtle`、`node:crypto` を使う
- セキュリティ目的の乱数は `crypto.randomUUID()` / `crypto.getRandomValues()`。
  `Math.random()` は不可
- 認証トークンの localStorage 保存禁止（XSS で抜かれる）。httpOnly Cookie を使う

### ログ

- 以下を INFO 以上で出さない：パスワード、トークン、JWT、フルクレカ番号、認証エンドポイント
  のリクエストボディ全体、メールアドレス（PII 扱い）

### GitHub Actions

- workflow の先頭で `permissions: {}` か `contents: read` を明示し、必要な権限は job ごとに足す（既定の権限はリポジトリの設定次第なので、書いていなければ指摘）。`id-token: write` は publish の job だけに付ける
- `pull_request_target`・`workflow_run`・`issue_comment` で PR のコードを checkout・実行しない。`actions/checkout` の `allow-unsafe-pr-checkout` や、`run:` の中の `git`・`gh` で PR のコードを取ってくるのも同じ
- `${{ github.event.* }}`・`${{ github.head_ref }}` などを `run:` に直接埋め込まない。`env:` で渡す（コマンドインジェクション）
- publish・release の job（`id-token: write`・`contents: write` を持つ）で、PR から書き込めるキャッシュを restore しない（`setup-node` の pnpm キャッシュを含む）。publish は `push`・`release`・`workflow_dispatch` からだけ行う。キャッシュへの書き込みは `permissions:` では止まらない
- サードパーティの action はタグではなくコミット SHA で固定する

---

## ソフトガイドライン（人間レビューに回す）

- 500 行を超えるファイルはセキュリティ問題が紛れやすい。リファクタ提案を添える
- 認証・入力処理での `@ts-expect-error` / `@ts-ignore` はバイパスの匂い。理由がないなら指摘
- セキュリティ関連のパスで `try { ... } catch { /* 黙殺 */ }` パターン
- 依存追加：ランタイム依存を増やす変更は justification を求める。standard library で済む
  ものを優先
