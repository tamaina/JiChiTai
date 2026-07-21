# JiChiTai - 市区町村タイピングゲーム

市区町村の名前や形を手がかりに、都道府県・自治体名をローマ字で答えるゲームです。Cloudflare Workers 上で Vue SPA と Hono API を動かし、e-Stat収録の全国1,747自治体（北方領土6村を含む）の実境界データで時間制限・練習モードを遊べます。

## 必要な環境

- Node.js 24 LTS（22 以上でも動作対象）
- pnpm 10.14 以上

## 開発

```sh
pnpm install
pnpm cf-typegen
pnpm dev
```

主なコマンドは次のとおりです。

```sh
pnpm check       # format、lint、型、単体テスト、ビルド
pnpm test:e2e    # Playwright E2E
pnpm preview     # 本番ビルドのローカルプレビュー
pnpm run deploy  # Cloudflare Workersへ手動デプロイ
pnpm geo:build   # 全国の境界形状と自治体データを再生成
```

初回デプロイ前のみ `pnpm exec wrangler login` で Cloudflare へログインしてください。公開設定は `VITE_*`（Vue）、通常の Worker 変数は `wrangler.jsonc` の `vars`、秘密情報は `wrangler secret put NAME` で管理します。ローカル秘密情報は `.dev.vars.example` を参考に `.dev.vars` へ置きます。

## 構成

- `src/app`: Vueアプリ、ルーター、画面、APIクライアント
- `src/shared`: クライアント・Worker間で共有する型とスキーマ
- `worker`: Hono API
- `tests`, `worker/*.spec.ts`: Vue・Worker単体テスト
- `e2e`: ブラウザE2E
- `docs`: 設計・開発ドキュメント

`/` から直接モード選択を表示します。`/api/*` だけを Worker が先に処理し、存在しない API は JSON 404 を返します。その他のパスは Workers Static Assets が配信し、見つからないパスは Vue SPA の `index.html` へフォールバックします。

詳細は [アーキテクチャ](docs/architecture.md)、[開発手順](docs/development.md)、[境界データの出典と生成](docs/data-sources.md) を参照してください。
