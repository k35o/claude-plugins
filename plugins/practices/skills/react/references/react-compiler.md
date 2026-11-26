# React Compiler

ビルド時にコンポーネントとフックを自動でメモ化するツール。v1.0で安定版になった。

## 有効かを確かめる

- `babel-plugin-react-compiler`が依存にあり、Babel、Vite、Metro、Rsbuildの設定で読み込んでいる
- Next.jsは`next.config`の`reactCompiler`で有効にする
- Expo SDK 54以降は既定で有効
- `compilationMode: 'annotation'`のときは、`"use memo"`を書いた関数だけがコンパイルされる

## コンパイラがメモ化するもの

- コンポーネントとフックの中の値、関数、JSX。早期returnの後や条件分岐の中でもメモ化する
- 子コンポーネントへのpropsが変わらなければ、子の再レンダーも飛ばす（`memo`と同じ効果）

次のものはメモ化しない。

- コンポーネントでもフックでもない関数
- コンポーネントやフックをまたいだ計算。同じ重い関数を多くのコンポーネントで呼ぶなら、計測してからReactの外でメモ化する

## 手でメモ化するとき

コンパイラが有効でも、`useMemo`と`useCallback`は細かく制御するための逃げ道として使える。典型は、エフェクトの依存配列に入る値を、意味のある変化がないのに作り直させたくないとき。依存配列のオブジェクトは、まずエフェクトの中で作るかプリミティブを取り出して依存から消し、消せないときに`useMemo`で参照を固定する。

- 手で書いた`useMemo`と`useCallback`の依存配列は省かない。依存が足りないと、コンパイラはそのコンポーネントを最適化しない（`preserve-manual-memoization`）
- 既存の`useMemo`、`useCallback`、`memo`は、外すとコンパイル結果が変わる。外すならテストで動きを確かめる

## コンパイラで壊れるコード

コンパイラはRules of Reactを守ったコードを前提にする。破っていると静的に分かったコンポーネントとフックはコンパイルせずに飛ばすが、分からなかったものは動きが変わることがある。

- メモ化に正しさを頼るコード。参照の同一性に依存するエフェクトや、参照の比較で分岐するコードは、メモ化のされ方が変わるとエフェクトの過剰な発火や無限ループ、更新漏れになる
- 内部で可変な状態を持つライブラリ。react-hook-formの`watch`やTanStack Tableの`useReactTable`は`incompatible-library`として検出され、そのコンポーネントは飛ばされる。react-hook-formでは`watch`の代わりに`useWatch`を使う
- MobXの`observer`はlintで検出されない。動かないときは`"use no memo"`を使う

原因を切り分けるときは、関数の先頭に`"use no memo"`を書いてコンパイルから外す。外した理由をコメントに書き、原因を直したら消す。

## lint

`eslint-plugin-react-hooks`の`recommended`には、コンパイラの診断にもとづくルール（`set-state-in-effect`、`set-state-in-render`、`refs`、`purity`、`immutability`、`static-components`など）が入っている。コンパイラを入れていないプロジェクトでも使える。指摘されたら、無効化コメントで消さずにコードを直す。
