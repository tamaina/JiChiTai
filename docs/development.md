# 開発手順

`wrangler.jsonc` を変更したら `pnpm cf-typegen` を実行し、生成された `worker-configuration.d.ts` を TypeScript から参照します。このファイルは環境依存の生成物なのでコミットしません。

変更前後に `pnpm check` を実行します。画面やルーティングを変更した場合は Chromium を `pnpm exec playwright install chromium` で用意し、`pnpm test:e2e` も実行します。

API は成功・失敗とも JSON を返し、公開ルートを `/api` 配下に置きます。新しい API 応答には共有スキーマを追加してください。Node.js 固有 API と `nodejs_compat` は、Web標準APIでは実装できない理由を ADR に残すまで導入しません。
