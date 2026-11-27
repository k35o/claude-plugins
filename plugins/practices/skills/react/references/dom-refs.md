# DOM操作とrefパターン

## 基本: DOM要素への参照

```tsx
const inputRef = useRef<HTMLInputElement>(null);
return <input ref={inputRef} />;
// inputRef.currentでDOM要素にアクセス
```

## フォーカス管理

```tsx
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={inputRef} />
      <button onClick={() => inputRef.current?.focus()}>フォーカス</button>
    </>
  );
}
```

## スクロール操作

```tsx
ref.current?.scrollIntoView({
  behavior: 'smooth',
  block: 'nearest',
  inline: 'center',
});
```

## リスト内の複数要素へのref（refコールバック）

ループ内ではuseRefを呼べないため、refコールバックとMapを使う。Mapは最初に使うときに作り、要素が外れたときの削除はrefコールバックが返すクリーンアップで行う。

```tsx
function List({ items }) {
  const mapRef = useRef<Map<string, HTMLElement> | null>(null);

  function getMap() {
    if (!mapRef.current) {
      mapRef.current = new Map();
    }
    return mapRef.current;
  }

  return items.map((item) => (
    <li
      key={item.id}
      ref={(node) => {
        const map = getMap();
        map.set(item.id, node);
        return () => {
          map.delete(item.id);
        };
      }}
    >
      {item.text}
    </li>
  ));
}
```

## 子コンポーネントのDOMへのアクセス

### React 19: refをpropとして渡す

```tsx
// 子
function MyInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}

// 親
const inputRef = useRef(null);
<MyInput ref={inputRef} />;
```

### useImperativeHandle: 公開APIの制限

子コンポーネントのDOMを直接公開せず、必要なメソッドだけを公開する。

```tsx
function MyInput({ ref }) {
  const realRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus() {
      realRef.current?.focus();
    },
    // scrollIntoViewやvalueなどは公開しない
  }));

  return <input ref={realRef} />;
}
```

## flushSync: DOM更新の即座反映

state更新後にDOMを参照する必要がある場合、flushSyncで同期的にDOMを更新する。

```tsx
import { flushSync } from 'react-dom';

function handleAdd(text: string) {
  flushSync(() => {
    setItems([...items, { id: nextId++, text }]);
  });
  // この時点でDOMは更新済み
  lastRef.current?.scrollIntoView();
}
```

## Fragment ref（React 19.3）

兄弟要素のまとまりや、refを受け取らないコンポーネントのDOMを扱うときは、`<Fragment>`にrefを渡す。refのためだけにラッパーの`<div>`を足すと、スタイルやレイアウトが変わる。`<>...</>`にはrefを渡せないので、`Fragment`をimportする。

```tsx
import { Fragment, useEffect, useRef } from 'react';

function PostList({ posts }) {
  const fragmentRef = useRef(null);

  useEffect(() => {
    // 子孫を深さ優先でたどり、最初にフォーカスできる要素にフォーカスする
    fragmentRef.current.focus();
  }, []);

  return (
    <Fragment ref={fragmentRef}>
      {posts.map((post) => (
        <Heading key={post.id}>{post.title}</Heading>
      ))}
    </Fragment>
  );
}
```

refの値は`FragmentInstance`で、DOMの構造を変えずに子をまとめて扱う。

- `addEventListener`、`removeEventListener`: 1階層目の子にイベントリスナーを付け外しする
- `dispatchEvent`: Fragmentの位置でイベントを発火する。バブリングするイベントはFragmentの親のDOMへ伝わる
- `focus`、`focusLast`: 子孫を深さ優先でたどり、フォーカスできる最初（最後）の要素にフォーカスする
- `blur`: フォーカスされている要素がFragmentの中にあるときだけフォーカスを外す
- `observeUsing`、`unobserveUsing`: `IntersectionObserver`や`ResizeObserver`で1階層目の子を監視する
- `getClientRects`、`getRootNode`、`compareDocumentPosition`、`scrollIntoView`: 1階層目の子の測定とスクロール

`FragmentInstance`の`scrollIntoView`は真偽値の`alignToTop`だけを受け取る。要素の`scrollIntoView({ behavior: 'smooth' })`のようにオプションのオブジェクトを渡すと例外になる。

## refクリーンアップ（React 19）

refコールバックからクリーンアップ関数を返せる。

```tsx
<div
  ref={(node) => {
    // ノードがDOMに追加されたとき
    const observer = new IntersectionObserver(callback);
    if (node) observer.observe(node);

    return () => {
      // ノードがDOMから削除されたとき
      observer.disconnect();
    };
  }}
/>
```

## DOM操作の安全ルール

**安全な操作（読み取り専用）:**

- フォーカス管理: `focus()`, `blur()`
- スクロール: `scrollIntoView()`, `scrollTo()`
- 測定: `getBoundingClientRect()`, `offsetWidth`

**危険な操作（Reactが管理するDOMの変更）:**

- `removeChild()` — ReactのDOMツリーと不整合になる
- `innerHTML` の直接変更
- `appendChild()` でReact管理ツリーにノードを追加

**例外**: Reactが更新する必要のない部分（常に空の`<div>`の中身など）は自由に変更可能。
