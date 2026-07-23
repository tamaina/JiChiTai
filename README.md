# JiChiTai - 市区町村タイピングゲーム

市区町村の名前や形を手がかりに、都道府県・自治体名をローマ字で答えるゲームです。Cloudflare Workers 上で Vue SPA と Hono API を動かし、e-Stat収録の全国1,747自治体（北方領土6村を含む）の実境界データで時間制限・練習モードを遊べます。

出題方法は「都道府県当て」「市区町村章当て」「市区町村当て」「タイピング」、ルールは「2分アタック」「練習」に対応しています。タイピングとは別に、自治体から市外局番を入力するクイズと、市外局番から自治体を選ぶ4択クイズも遊べます。全国・都道府県地図から自治体コード、市外局番、郵便番号上2桁、市区町村章を確認できる一覧ビューワーも備えています。

FSRS暗記モードでは、自治体名・輪郭・市区町村章・市外局番の4方式を独立したカードとして学習できます。4段階の自己評価から次回の復習時期を計算し、履歴はブラウザのIndexedDBへ保存します。履歴はJSONで書き出せます。読み込み時は確認後、端末内の履歴をJSONの内容で全置換します。

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
pnpm area-codes:build # J-LISから代表電話と市外局番を再生成
pnpm emblems:build # WikidataとCommonsから市区町村章を再生成
pnpm postal-prefixes:build # 日本郵便から郵便番号上2桁を再生成
```

初回デプロイ前のみ `pnpm exec wrangler login` で Cloudflare へログインしてください。公開設定は `VITE_*`（Vue）、通常の Worker 変数は `wrangler.jsonc` の `vars`、秘密情報は `wrangler secret put NAME` で管理します。ローカル秘密情報は `.dev.vars.example` を参考に `.dev.vars` へ置きます。

## 構成

- `src/app`: Vueアプリ、ルーター、画面、APIクライアント
- `src/shared`: クライアント・Worker間で共有する型とスキーマ
- `worker`: Hono API
- `data`: e-Statから取得した自治体マスター
- `scripts`: 自治体データとSVGの生成処理
- `public/generated`: 自治体別・都道府県別SVG
- `tests`, `worker/*.spec.ts`: Vue・Worker単体テスト
- `e2e`: ブラウザE2E
- `docs`: 設計・開発ドキュメント

`/` から直接モード選択を表示します。`/api/*` だけを Worker が先に処理し、存在しない API は JSON 404 を返します。その他のパスは Workers Static Assets が配信し、見つからないパスは Vue SPA の `index.html` へフォールバックします。

`INSTRUCTIONS.md` は初期要件の原本です。現在の構成・操作方法についてはREADMEと`docs/`を参照してください。

詳細は [アーキテクチャ](docs/architecture.md)、[開発手順](docs/development.md)、[境界データの出典と生成](docs/data-sources.md) を参照してください。
