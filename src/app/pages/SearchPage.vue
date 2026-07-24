<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { searchMunicipalities } from '../../shared/data/municipality-search'

const query = ref('')
const normalizedQuery = computed(() => query.value.trim())
const results = computed(() => searchMunicipalities(query.value))
</script>

<template>
  <section class="page-section search-page">
    <p class="eyebrow">自治体検索</p>
    <h1>自治体を検索</h1>
    <p class="lead">
      自治体名、市外局番、郵便番号から自治体を探せます。自治体名は漢字・ひらがな・カタカナ・ローマ字の一部でも検索できます。
    </p>

    <label class="search-control">
      <span class="search-label">検索キーワード</span>
      <span class="search-input-wrap">
        <Search :size="20" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          inputmode="search"
          autocomplete="off"
          placeholder="例: 川崎、かわさき、0857、680-8571"
        />
      </span>
      <small>郵便番号は上3桁、またはハイフンを含む7桁で検索できます。</small>
    </label>

    <section
      v-if="normalizedQuery"
      class="search-results"
      aria-labelledby="search-results-heading"
    >
      <div class="search-results-heading">
        <h2 id="search-results-heading">検索結果</h2>
        <span aria-live="polite">{{ results.length }}自治体</span>
      </div>

      <ul v-if="results.length" class="search-result-list">
        <li v-for="result in results" :key="result.municipality.code">
          <RouterLink
            class="search-result-row"
            :to="{
              path: '/explore',
              query: {
                prefecture: result.municipality.prefectureCode,
                municipality: result.municipality.code,
              },
            }"
          >
            <span class="search-result-name">
              <small>{{ result.municipality.prefecture.name }}</small>
              <strong>{{ result.municipality.name }}</strong>
              <span>{{ result.municipality.kana }}</span>
            </span>
            <span class="search-result-data">
              <span v-if="result.matchedAreaCodes.length">
                市外局番 {{ result.matchedAreaCodes.join('、') }}
              </span>
              <span v-if="result.matchedPostalCodePrefixes.length">
                〒 {{ result.matchedPostalCodePrefixes.join('、') }}
              </span>
              <small>{{ result.municipality.code }}</small>
            </span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="empty-results">
        該当する自治体はありません。表記や番号を変えてお試しください。
      </p>
    </section>

    <p v-else class="search-prompt">
      キーワードを入力すると検索結果が表示されます。
    </p>
  </section>
</template>

<style scoped>
.search-page {
  max-width: 48rem;
  margin: 0 auto;
}
.search-page .lead {
  margin-bottom: var(--space-8);
}
.search-control {
  display: grid;
  gap: var(--space-2);
}
.search-label {
  font-weight: 600;
}
.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.search-input-wrap > svg {
  position: absolute;
  left: var(--space-4);
  color: var(--color-muted);
  pointer-events: none;
}
.search-input-wrap input {
  width: 100%;
  height: 52px;
  padding: 0 var(--space-4) 0 48px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 16px;
}
.search-input-wrap input:focus-visible {
  border-color: var(--color-focus);
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-focus);
}
.search-control small,
.search-prompt,
.empty-results,
.search-results-heading span,
.search-result-name small,
.search-result-name > span,
.search-result-data {
  color: var(--color-muted);
}
.search-control small {
  font-size: 13px;
}
.search-results {
  margin-top: var(--space-8);
}
.search-results-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.search-results-heading h2 {
  margin: 0;
}
.search-results-heading span {
  font-size: 13px;
}
.search-result-list {
  padding: 0;
  margin: 0;
  list-style: none;
}
.search-result-list li {
  border-bottom: 1px solid var(--color-border);
}
.search-result-row {
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-3);
  color: inherit;
  text-decoration: none;
}
.search-result-row:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}
.search-result-name,
.search-result-data {
  display: grid;
  gap: 2px;
}
.search-result-name {
  grid-template-columns: auto 1fr;
  align-items: baseline;
  column-gap: var(--space-2);
}
.search-result-name small,
.search-result-name > span {
  grid-column: 1 / -1;
  font-size: 12px;
}
.search-result-name strong {
  grid-column: 1 / -1;
  font-size: 17px;
}
.search-result-data {
  flex: 0 1 13rem;
  font-size: 13px;
  text-align: right;
}
.search-result-data small {
  font-size: 12px;
}
.search-prompt,
.empty-results {
  padding: var(--space-6) 0;
}
@media (max-width: 520px) {
  .search-result-row {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }
  .search-result-data {
    flex-basis: auto;
    text-align: left;
  }
}
</style>
