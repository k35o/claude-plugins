---
name: react
description: Reactのコンポーネントやフックを書く、直す、レビューするときに使う。useEffectやuseRefの使い方、メモ化とReact Compiler、React 19の新しいAPI、Server Componentsの境界を判断するときや、「Reactで作って」「このコンポーネント直して」「useEffect要る？」「useMemo要る？」と言われたときにも使う。
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

依存配列は選ぶものではなくコードから導出されるもの。オブジェクトや関数が依存配列に入りそうになったら [references/effect-dependencies.md](references/effect-dependencies.md) を読む。エフェクトから最新のprops/stateを読みたいが、その変化では再実行したくない処理は`useEffectEvent`に切り出す。依存を減らすためだけには使わない。エフェクトを書いたら、カスタムフックへの抽出を検討する。

## ref

レンダー中に`ref.current`を読み書きしない（一度きりの初期化は例外）。フォーカスやスクロール、リスト内の複数ref、`useImperativeHandle`、`flushSync`を扱うときは [references/dom-refs.md](references/dom-refs.md) を読む。

## メモ化とReact Compiler

`useMemo`、`useCallback`、`memo`を書く前、外す前に、プロジェクトでReact Compilerが有効かを確かめる。

- 有効なら、新しいコードに手でメモ化を書かない。コンパイラがコンポーネントとフックの中の値、関数、JSXをメモ化する。
- 有効でも、エフェクトの依存に入る値の参照を固定したいときは`useMemo`と`useCallback`を逃げ道として使う。
- 既存のメモ化は、外すとコンパイル結果が変わる。外すならテストで確かめる。
- 無効なら、計測して重いと分かった計算と、`memo`した子に渡す値や関数だけをメモ化する。

有効かの見分け方、コンパイラがメモ化しないもの、コンパイラで壊れるコードと`"use no memo"`を確かめるときは [references/react-compiler.md](references/react-compiler.md) を読む。

## React 19とConcurrent

- 非同期処理の状態管理はActions（`useTransition`とasync関数）を使う。フォームは`useActionState`、楽観的UIは`useOptimistic`。
- Promiseやコンテキストは`use`でレンダー中に読む。条件分岐の中でも呼べる。try-catchの中では呼べないので、rejectはError Boundaryで受ける。
- Client Componentで`use`に渡すPromiseは、レンダーをまたいで同じものを使う。レンダー中に`fetch`やasync関数を呼ぶと毎回新しいPromiseになり、fallbackが出続ける。Server Componentやイベントハンドラ、ルートのローダーで作ったPromiseを渡すか、キャッシュする。
- refコールバックはクリーンアップ関数を返せる。
- 重いstate更新は`startTransition`、高頻度で変わる値は`useDeferredValue`、非同期データの読み込み中の表示は`Suspense`で扱う。ローディング状態をuseStateとuseEffectで管理しない。
- 隠しても中のstateやDOMを残したいUI（タブ、サイドバー）と、次に表示しそうなUIの先読みは、条件付きレンダーではなく`<Activity mode={isVisible ? 'visible' : 'hidden'}>`で切り替える。隠れている間はエフェクトがクリーンアップされ、propsの更新は低い優先度で描画される。
- `<Activity>`で隠してもDOMは残るので、`<video>`、`<audio>`、`<iframe>`は再生が続く。`useLayoutEffect`のクリーンアップで止める。先読みされるのは`use`などSuspenseで読むデータだけで、エフェクトでの取得は先読みされない。

## Server Components

Server Componentsが既定で、`"use client"`を付けたものだけがClient Componentになる。

- `"use client"`の境界はできるだけ葉に近い位置に置く。ページ全体をClient Componentにしない。
- Server Functions（`"use server"`の関数）の引数は信頼できない入力として扱い、認証と認可を必ず検証する。
- Server Functionsはサーバーの状態を変える処理に使い、データの取得には使わない。データはServer Componentで取得する。
- サーバーとクライアントの間で渡すデータはシリアライズ可能にする。

`"use client"`と`"use server"`の細かいルール、compositionパターン、シリアライズ可能な型、`cacheSignal`での中断を確かめるときは [references/rsc.md](references/rsc.md) を読む。

## Gotcha

- 安定版になったAPIを、学習データにある接頭辞つきの名前でimportしがち。`useEffectEvent`（旧`experimental_useEffectEvent`）と`<Activity>`（旧`unstable_Activity`）は、React 19.2から`react`の通常のexport。
- 新しいAPIを書く、勧める前に`package.json`の`react`のバージョンを確かめる。`useEffectEvent`、`<Activity>`、`cacheSignal`は19.2から。
