<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Search } from '@lucide/vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  searchMunicipalities,
  type MunicipalitySearchMode,
} from '../../shared/data/municipality-search'

const route = useRoute()
const router = useRouter()
const routeQuery = () =>
  typeof route.query.q === 'string' ? route.query.q : ''

const query = ref(routeQuery())
const mode = ref<MunicipalitySearchMode>('all')
const normalizedQuery = computed(() => query.value.trim())
const results = computed(() => searchMunicipalities(query.value, mode.value))
let queryHistoryTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => route.query.q,
  () => {
    const nextQuery = routeQuery()
    if (query.value !== nextQuery) query.value = nextQuery
  },
)

watch(query, (nextQuery) => {
  clearTimeout(queryHistoryTimer)

  const q = nextQuery.trim()
  if (q === routeQuery()) return

  queryHistoryTimer = setTimeout(() => {
    const nextRouteQuery = { ...route.query }
    delete nextRouteQuery.q
    void router.push({
      path: '/search',
      query: q ? { ...nextRouteQuery, q } : nextRouteQuery,
    })
  }, 1000)
})

onBeforeUnmount(() => clearTimeout(queryHistoryTimer))

const inputPlaceholder = computed(() => {
  if (mode.value === 'postal') return '例: 680、680-8571'
  if (mode.value === 'phone') return '例: 0857、0857-22-8111'
  return '例: 川崎、かわさき、0857、680-8571'
})
const inputHelp = computed(() => {
  if (mode.value === 'postal')
    return '郵便番号は上3桁、またはハイフンを含む7桁で検索できます。'
  if (mode.value === 'phone')
    return '本庁代表電話は番号全体、それ以外の電話番号は市外局番まで絞り込みます。'
  return '名前、市外局番、本庁代表電話、郵便番号から横断検索します。'
})
</script>

<template>
  <section class="page-section search-page">
    <p class="eyebrow">自治体検索</p>
    <h1>自治体を検索</h1>
    <p class="lead">
      自治体名、郵便番号、電話番号から自治体を探せます。「すべて」では、自治体名を漢字・ひらがな・カタカナ・ローマ字の一部でも検索できます。
    </p>

    <fieldset class="search-mode">
      <legend>検索対象</legend>
      <label>
        <input v-model="mode" type="radio" value="all" />
        すべて
      </label>
      <label>
        <input v-model="mode" type="radio" value="postal" />
        郵便番号
      </label>
      <label>
        <input v-model="mode" type="radio" value="phone" />
        電話番号
      </label>
    </fieldset>

    <label class="search-control">
      <span class="search-label">検索キーワード</span>
      <span class="search-input-wrap">
        <Search :size="20" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          :inputmode="mode === 'all' ? 'search' : 'numeric'"
          autocomplete="off"
          :placeholder="inputPlaceholder"
        />
      </span>
      <small>{{ inputHelp }}</small>
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
              <span v-if="result.matchedPhoneNumbers.length">
                本庁代表電話 {{ result.matchedPhoneNumbers.join('、') }}
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
  margin-bottom: var(--space-6);
}
.search-mode {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  margin: 0 0 var(--space-5);
  border: 0;
}
.search-mode legend {
  width: 100%;
  margin-bottom: var(--space-2);
  font-weight: 600;
}
.search-mode label {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  padding: 0 var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  cursor: pointer;
}
.search-mode label:has(input:checked) {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface));
  color: var(--color-accent);
}
.search-mode label:has(input:focus-visible) {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
}
.search-mode input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
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
</style>
