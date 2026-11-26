# テストダブルの使い方

## 既定はFake

Mock、StubよりもFake（簡易的な代替実装）を使う。Fakeはプロダクトコードの内部構造に結合しにくく、テストサイズもLargeからMediumに下げられる。

- DynamoDB → DynamoDB Local（コンテナ）
- 外部API → インメモリの簡易実装
- ファイルシステム → インメモリFS

## Mockを使うときの注意

Mockで「呼ばれたこと」だけを検証すると、プロダクトコードの内部構造に結合し、メソッド名やシグネチャを変えただけでテストが壊れる。テストダブルを使っても、最終的な出力や副作用の結果を検証する。

```tsx
// ❌ 実装の内部構造に結合
const mockRepo = jest.fn().mockReturnValue(user);
service.getUser(1);
expect(mockRepo).toHaveBeenCalledWith(1);

// ✅ 振る舞いで検証
const result = service.getUser(1);
expect(result).toEqual({ id: 1, name: 'Alice' });
```

## 置き場所

- テストダブルはテスト対象の境界（外部サービス、時刻、乱数）に置く。テスト対象の内部には挟まない。
- テストダブルを足した結果、何をテストしているのかが曖昧になったら、境界の切り方を見直す。
