# アーキテクチャ

Vue 3 SPA は画面表示とクライアント状態を担当し、Hono を使った Worker は `/api/*` の入力検証、出題セッション、将来のサーバー判定を担当します。Vue コンポーネントは直接 `fetch` を散在させず、`src/app/api` を介して Valibot で応答を検証します。

## 配信経路

Workers Static Assets がビルド済み SPA と将来の形状 JSON/SVG を配信します。`run_worker_first` は `/api/*` のみに限定し、不明な API が SPA HTML を返すことを防ぎます。Web画面の不明なパスには `single-page-application` のフォールバックを適用します。

形状は全国分を API 応答へ埋め込まず、最適化済みの自治体別または都道府県別アセットとして配信します。出題 API は形状 ID または URL だけを返す方針です。

## 将来の Cloudflare サービス

初期版は D1、R2、KV、Durable Objects を使いません。ランキングや共有結果には D1、大きな地理原本には必要に応じて R2、強いセッション整合性が必要になった場合のみ Durable Objects を検討します。匿名利用統計は Analytics Engine の候補です。
