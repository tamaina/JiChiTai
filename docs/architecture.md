# アーキテクチャ

Vue 3 SPA は画面表示、回答判定、タイマー、履歴、結果集計を担当します。Hono を使った Worker は `/api/*` の入力検証と、フィルタ済みの出題セッション・追加問題の配信を担当します。Vue コンポーネントは直接 `fetch` を散在させず、`src/app/api` を介して Valibot で応答を検証します。

## 配信経路

Workers Static Assets がビルド済みSPAと`public/generated`の形状SVGを配信します。`run_worker_first` は `/api/*` のみに限定し、不明なAPIがSPA HTMLを返すことを防ぎます。Web画面の不明なパスには `single-page-application` のフォールバックを適用します。

自治体メタデータは`src/shared/data/generated-municipalities.ts`としてクライアントとWorkerへバンドルします。形状は全国分をAPI応答へ埋め込まず、`/generated/geometry/{自治体コード}.svg`と`/generated/prefectures/{都道府県コード}.svg`へ分離しています。出題APIは自治体コード、都道府県コード、自治体SVG URLを10問ずつ返します。

出題順はセッションIDを種にしてWorker側で決定します。クライアントは残り3問で次の10問を取得し、画面外の次問題と都道府県SVGを`img`として読み込んで表示切り替えに備えます。正誤判定は共有自治体辞書とWanaKanaによるローマ字変換を使い、クライアント内で完結します。

## 将来の Cloudflare サービス

現在はD1、R2、KV、Durable Objectsを使いません。ランキングや結果保存を導入する場合はD1、大きな地理原本を実行時に扱う必要が生じた場合はR2、強いセッション整合性が必要になった場合のみDurable Objectsを検討します。匿名利用統計はAnalytics Engineの候補です。
