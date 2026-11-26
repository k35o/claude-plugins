---
name: react
description: Reactのコンポーネントやフックを書く、直す、レビューするときに使う。useEffectやuseRefの使い方、React 19の新しいAPI、Server Componentsの境界を判断するときや、「Reactで作って」「このコンポーネント直して」「useEffect要る？」と言われたときにも使う。
---

# React

パフォーマンス最適化ではなく、Reactのメンタルモデルに沿った正しいコードを書くためのスキル。学習データには古いReactが多く含まれるので、意識して現行のAPIに寄せる。

## 書かないもの

- `useMount`や`useEffectOnce`のようなライフサイクルフック
- `useEffect`内でstateを更新して派生値を計算する
- `useEffect`にイベントハンドラのロジックを書く
- コンポーネントの中でコンポーネントを定義する（レンダーごとにstateが消える）
- `forwardRef`と`<Context.Provider>`（React 19ではrefは通常のprop、Contextは`<Context>`を直接使う）
- `// eslint-disable-next-line react-hooks/exhaustive-deps`。リンタが警告したらコードを直す
- 1つのuseStateをラップするだけのカスタムフック

## useEffect

useEffectは外部システム（ブラウザAPI、サードパーティライブラリ、WebSocketなど）との同期のためだけに使う。エフェクトを書く前に [references/no-effect-patterns.md](references/no-effect-patterns.md) を読み、不要なパターンに当たらないかを確かめる。

依存配列は選ぶものではなくコードから導出されるもの。オブジェクトや関数が依存配列に入りそうになったら [references/effect-dependencies.md](references/effect-dependencies.md) を読む。エフェクトを書いたら、カスタムフックへの抽出を検討する。

## ref

レンダー中に`ref.current`を読み書きしない（一度きりの初期化は例外）。フォーカスやスクロール、リスト内の複数ref、`useImperativeHandle`、`flushSync`を扱うときは [references/dom-refs.md](references/dom-refs.md) を読む。

## React 19とConcurrent

- 非同期処理の状態管理はActions（`useTransition`とasync関数）を使う。フォームは`useActionState`、楽観的UIは`useOptimistic`。
- Promiseやコンテキストは`use`でレンダー中に読む。条件分岐の中でも呼べる。
- refコールバックはクリーンアップ関数を返せる。
- 重いstate更新は`startTransition`、高頻度で変わる値は`useDeferredValue`、非同期データの読み込み中の表示は`Suspense`で扱う。ローディング状態をuseStateとuseEffectで管理しない。

## Server Components

Server Componentsが既定で、`"use client"`を付けたものだけがClient Componentになる。

- `"use client"`の境界はできるだけ葉に近い位置に置く。ページ全体をClient Componentにしない。
- Server Actionsの引数は信頼できない入力として扱い、認証と認可を必ず検証する。
- サーバーとクライアントの間で渡すデータはシリアライズ可能にする。

`"use client"`と`"use server"`の細かいルール、compositionパターン、シリアライズ可能な型を確かめるときは [references/rsc.md](references/rsc.md) を読む。
