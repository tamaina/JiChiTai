# ADR 0001: Vue SPA と Hono Worker を単一 Workers プロジェクトで配信する

- 状態: 採用
- 日付: 2026-07-22

Cloudflare Vite Plugin と Workers Static Assets を使って Vue SPA を配信し、`/api/*` は Hono Worker で処理する。Cloudflare Pages、Workers Sites、Node.js互換モードは使わない。

これにより SPA と API を同一オリジンで開発・配信でき、形状アセットには CDN キャッシュを利用できる。APIルートだけを Worker-first にするため、不明なWeb画面はSPAへ、不明なAPIはJSON 404へ明確に分岐する。

`compatibility_date` は作業日（2026-07-22）ではなく、導入時にデプロイ対象として選んだ2026-07-14とする。作業日をそのまま設定すると、当時のMiniflareが未来の日付として起動を拒否したためである。

2026-07-22時点の`@cloudflare/vitest-pool-workers`に同梱されたテスト用Runtimeは2026-03-10までをサポートし、テスト時に同日へフォールバックする警告を出す。`wrangler.jsonc`のデプロイ対象日は変更せず、Cloudflare依存関係の更新時にテスト用Runtimeの対応状況を再確認する。
