# ADR 0001: Vue SPA と Hono Worker を単一 Workers プロジェクトで配信する

- 状態: 採用
- 日付: 2026-07-22

Cloudflare Vite Plugin と Workers Static Assets を使って Vue SPA を配信し、`/api/*` は Hono Worker で処理する。Cloudflare Pages、Workers Sites、Node.js互換モードは使わない。

これにより SPA と API を同一オリジンで開発・配信でき、形状アセットには CDN キャッシュを利用できる。APIルートだけを Worker-first にするため、不明なWeb画面はSPAへ、不明なAPIはJSON 404へ明確に分岐する。

`compatibility_date` は作業日（2026-07-22）ではなく、導入時の最新 workerd が受理する 2026-07-14 とする。作業日を設定すると現行 Miniflare が未来の日付として起動を拒否するためである。依存関係更新時に再確認する。
