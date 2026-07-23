<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
</script>

<template>
  <article class="page-section prose about-page">
    <p class="eyebrow">日本全国・市区町村タイピングゲーム</p>
    <h1>JiChiTai</h1>

    <section>
      <h2>このゲームについて</h2>
      <p>
        日本全国の自治体名と実際の境界形状を使ったタイピングゲームです。市区町村の読みや形を手がかりに、ローマ字入力で遊びながら地名を覚えられます。
      </p>
      <p>
        出題範囲は「すべての市区町村」「人口トップ1000」「市のみ」から選べます。「人口トップ1000」は、2020年国勢調査の総人口を基準に、ゲーム収録自治体の上位1,000件を対象としています。
      </p>
    </section>

    <section>
      <h2>データソース</h2>
      <ul class="about-link-list">
        <li>
          <a
            href="https://www.e-stat.go.jp/municipalities/cities"
            target="_blank"
            rel="noopener noreferrer"
          >
            e-Stat「市区町村名・コード」
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
          <span>自治体コード、正式名称、読み</span>
        </li>
        <li>
          <a
            href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2024.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            国土数値情報「行政区域データ」
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
          <span>市区町村の行政境界</span>
        </li>
        <li>
          <a
            href="https://www.nstac.go.jp/use/literacy/ssdse/"
            target="_blank"
            rel="noopener noreferrer"
          >
            統計センター「教育用標準データセット SSDSE-A-2024」
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
          <span>2020年国勢調査の市区町村別総人口</span>
        </li>
        <li>
          <a
            href="https://github.com/geolonia/japanese-admins"
            target="_blank"
            rel="noopener noreferrer"
          >
            geolonia/japanese-admins
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
          <span>国土数値情報を加工した自治体別GeoJSON</span>
        </li>
        <li>
          <a
            href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-W09-2005.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            国土数値情報「湖沼データ」
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
          <span>面積10km²以上の湖沼・貯水池の水域形状</span>
        </li>
        <li>
          <a
            href="https://www.wikidata.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikidata
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
          <span>市区町村コードと市区町村章の対応</span>
        </li>
        <li>
          <a
            href="https://commons.wikimedia.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikimedia Commons
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
          <span>ライセンス確認済みの市区町村章画像</span>
        </li>
      </ul>
    </section>

    <section>
      <h2>参考にした作品</h2>
      <p>ゲームの着想や体験設計にあたり、次の作品を参考にしました。</p>
      <ul class="about-link-list about-link-list-compact">
        <li>
          <a
            href="https://shikuchoson.jp/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ShiKuChoSon
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
        </li>
        <li>
          <a
            href="https://hokkaidle.web.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hokkaidle
            <ExternalLink :size="15" aria-hidden="true" />
          </a>
        </li>
      </ul>
    </section>

    <section>
      <h2>制作</h2>
      <dl class="about-credits">
        <div>
          <dt>作者</dt>
          <dd>aqz/tamaina</dd>
        </div>
        <div>
          <dt>ソースコード</dt>
          <dd>
            <a
              href="https://github.com/tamaina/JiChiTai"
              target="_blank"
              rel="noopener noreferrer"
            >
              tamaina/JiChiTai
              <ExternalLink :size="15" aria-hidden="true" />
            </a>
          </dd>
        </div>
        <div>
          <dt>Support me</dt>
          <dd>
            <a
              href="https://github.com/sponsors/tamaina"
              target="_blank"
              rel="noopener noreferrer"
            >
              sponsors/tamaina
              <ExternalLink :size="15" aria-hidden="true" />
            </a>
          </dd>
        </div>
      </dl>
    </section>
  </article>
</template>
