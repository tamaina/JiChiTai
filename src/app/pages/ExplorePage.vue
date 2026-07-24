<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, Map as MapIcon } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import MunicipalityMap from '../components/MunicipalityMap.vue'
import {
  municipalities,
  municipalityByCode,
  municipalityShapeUrl,
  prefectureByCode,
  prefectures,
  type MunicipalityRecord,
} from '../../shared/data/municipalities'

const route = useRoute()
const router = useRouter()

const selectedPrefectureCode = computed(() => {
  const code =
    typeof route.query.prefecture === 'string' ? route.query.prefecture : null
  return code && prefectureByCode.has(code) ? code : null
})
const selectedMunicipalityCode = computed(() => {
  const code =
    typeof route.query.municipality === 'string'
      ? route.query.municipality
      : null
  const record = code ? municipalityByCode.get(code) : undefined
  return record?.prefectureCode === selectedPrefectureCode.value ? code : null
})
const selectedPrefecture = computed(() =>
  selectedPrefectureCode.value
    ? prefectureByCode.get(selectedPrefectureCode.value)
    : null,
)
const selectedMunicipality = computed(() =>
  selectedMunicipalityCode.value
    ? municipalityByCode.get(selectedMunicipalityCode.value)
    : null,
)
const prefectureMunicipalities = computed(() =>
  selectedPrefectureCode.value
    ? municipalities.filter(
        (item) => item.prefectureCode === selectedPrefectureCode.value,
      )
    : [],
)
const municipalityCounts = new Map<string, number>()
for (const record of municipalities)
  municipalityCounts.set(
    record.prefectureCode,
    (municipalityCounts.get(record.prefectureCode) ?? 0) + 1,
  )

function selectPrefecture(code: string) {
  void router.push({ path: '/explore', query: { prefecture: code } })
}

function selectMunicipality(code: string) {
  void router.push({
    path: '/explore',
    query: {
      prefecture: selectedPrefectureCode.value ?? undefined,
      municipality: code,
    },
  })
}

function showNationwide() {
  void router.push({ path: '/explore' })
}

function showMunicipalityList() {
  void router.push({
    path: '/explore',
    query: { prefecture: selectedPrefectureCode.value ?? undefined },
  })
}

function orderedAreaCodes(record: MunicipalityRecord) {
  if (!record.primaryAreaCode) return record.areaCodes
  return [
    record.primaryAreaCode,
    ...record.areaCodes.filter((code) => code !== record.primaryAreaCode),
  ]
}

function formatPostalPrefixes(prefixes: string[]) {
  const sorted = [...new Set(prefixes)].sort((first, second) =>
    first.localeCompare(second),
  )
  const groups: string[] = []

  for (let start = 0; start < sorted.length;) {
    let end = start
    while (
      end + 1 < sorted.length &&
      Number(sorted[end + 1]) === Number(sorted[end]) + 1
    )
      end += 1

    if (end - start >= 2) groups.push(`${sorted[start]}〜${sorted[end]}`)
    else groups.push(...sorted.slice(start, end + 1))
    start = end + 1
  }

  return groups.join('・')
}
</script>

<template>
  <section class="page-section explore-page">
    <p class="eyebrow">自治体データビューワー</p>
    <div class="explore-heading">
      <div>
        <h1>
          {{
            selectedMunicipality
              ? `${selectedMunicipality.prefecture.name}${selectedMunicipality.name}`
              : (selectedPrefecture?.name ?? '日本全国')
          }}
        </h1>
        <p>
          地図または一覧から選択すると、自治体コード・市外局番・郵便番号を確認できます。
        </p>
      </div>
      <button
        v-if="selectedPrefecture"
        type="button"
        class="button"
        @click="showNationwide"
      >
        <ArrowLeft :size="17" />
        全国へ戻る
      </button>
    </div>

    <div class="explore-layout">
      <section class="explore-map-panel" aria-labelledby="map-heading">
        <h2 id="map-heading" class="panel-heading">
          <MapIcon :size="19" />
          {{
            selectedPrefecture ? `${selectedPrefecture.name}の地図` : '全国地図'
          }}
        </h2>
        <MunicipalityMap
          :prefecture-code="selectedPrefectureCode"
          :selected-municipality-code="selectedMunicipalityCode"
          @select-prefecture="selectPrefecture"
          @select-municipality="selectMunicipality"
        />
      </section>

      <section class="explore-data-panel" aria-live="polite">
        <template v-if="selectedMunicipality">
          <button
            type="button"
            class="text-button back-to-list"
            @click="showMunicipalityList"
          >
            <ArrowLeft :size="16" />
            {{ selectedPrefecture?.name }}の一覧へ戻る
          </button>
          <article class="municipality-detail">
            <img
              v-if="selectedMunicipality.emblem"
              class="detail-emblem"
              :src="selectedMunicipality.emblem.imageUrl"
              :alt="`${selectedMunicipality.name}の市区町村章`"
            />
            <p class="detail-reading">
              <span v-if="selectedMunicipality.districtName">{{
                selectedMunicipality.districtName
              }}</span>
              <span>{{ selectedMunicipality.kana }}</span>
            </p>
            <h2>{{ selectedMunicipality.name }}</h2>
            <dl class="detail-data">
              <div>
                <dt>自治体コード</dt>
                <dd>{{ selectedMunicipality.code }}</dd>
              </div>
              <div>
                <dt>市外局番</dt>
                <dd>
                  {{
                    selectedMunicipality.areaCodes.length
                      ? orderedAreaCodes(selectedMunicipality).join('、')
                      : 'データなし'
                  }}
                </dd>
              </div>
              <div>
                <dt>郵便番号 上3桁</dt>
                <dd>
                  {{
                    selectedMunicipality.postalCodePrefixes.length
                      ? formatPostalPrefixes(
                          selectedMunicipality.postalCodePrefixes,
                        )
                      : 'データなし'
                  }}
                </dd>
              </div>
              <div v-if="selectedMunicipality.representativePhone">
                <dt>本庁代表電話</dt>
                <dd>{{ selectedMunicipality.representativePhone }}</dd>
              </div>
            </dl>
            <img
              class="detail-shape-image"
              :src="municipalityShapeUrl(selectedMunicipality.code)"
              :alt="`${selectedMunicipality.name}の形`"
            />
            <p v-if="selectedMunicipality.emblem" class="detail-attribution">
              市区町村章:
              <a
                :href="selectedMunicipality.emblem.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ selectedMunicipality.emblem.author }}</a
              >
              /
              <a
                v-if="selectedMunicipality.emblem.licenseUrl"
                :href="selectedMunicipality.emblem.licenseUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ selectedMunicipality.emblem.licenseName }}</a
              >
              <span v-else>{{ selectedMunicipality.emblem.licenseName }}</span>
            </p>
          </article>
        </template>

        <template v-else-if="selectedPrefecture">
          <div class="panel-title">
            <h2>市区町村一覧</h2>
            <span>{{ prefectureMunicipalities.length }}自治体</span>
          </div>
          <ul class="viewer-list municipality-list">
            <li
              v-for="municipality in prefectureMunicipalities"
              :key="municipality.code"
            >
              <button
                type="button"
                class="viewer-list-row"
                @click="selectMunicipality(municipality.code)"
              >
                <span class="viewer-list-name">
                  <strong>{{ municipality.name }}</strong>
                  <small>{{ municipality.code }}</small>
                </span>
                <span class="viewer-list-facts">
                  <span
                    >市外局番
                    {{ orderedAreaCodes(municipality).join('、') || '—' }}</span
                  >
                  <span
                    >〒
                    {{
                      formatPostalPrefixes(municipality.postalCodePrefixes) ||
                      '—'
                    }}</span
                  >
                </span>
              </button>
            </li>
          </ul>
        </template>

        <template v-else>
          <div class="panel-title">
            <h2>都道府県一覧</h2>
            <span>47都道府県</span>
          </div>
          <ul class="viewer-list prefecture-list">
            <li v-for="prefecture in prefectures" :key="prefecture.code">
              <button
                type="button"
                class="viewer-list-row"
                @click="selectPrefecture(prefecture.code)"
              >
                <span class="viewer-list-name">
                  <strong>{{ prefecture.name }}</strong>
                  <small>都道府県コード {{ prefecture.code }}</small>
                </span>
                <span>{{ municipalityCounts.get(prefecture.code) }}自治体</span>
              </button>
            </li>
          </ul>
        </template>
      </section>
    </div>
  </section>
</template>

<style scoped>
.explore-page {
  --explore-panel-border: 1px solid var(--color-border);
}
.explore-heading {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}
.explore-heading p {
  max-width: 48rem;
  margin-bottom: 0;
  color: var(--color-muted);
}
.explore-layout {
  display: grid;
  gap: var(--space-5);
}
.explore-map-panel,
.explore-data-panel {
  min-width: 0;
  border: var(--explore-panel-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}
.explore-map-panel {
  padding: var(--space-4);
}
.explore-data-panel {
  padding: var(--space-4);
}
.panel-heading,
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.panel-heading {
  justify-content: flex-start;
}
.panel-title span {
  color: var(--color-muted);
  font-size: 13px;
}
.viewer-list {
  display: block;
  max-height: min(64vh, 720px);
  padding: 0;
  margin: var(--space-3) 0 0;
  overflow-y: auto;
  list-style: none;
}
.prefecture-list,
.municipality-list {
  margin-right: calc(-1 * var(--space-4));
  padding-right: var(--space-4);
}
.viewer-list li + li {
  border-top: 1px solid var(--color-border);
}
.viewer-list-row {
  display: flex;
  width: 100%;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.viewer-list-row:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}
.viewer-list-row:focus-visible {
  outline-width: 2px;
  outline-offset: -3px;
}
.viewer-list-name,
.viewer-list-facts {
  display: grid;
  gap: 2px;
}
.viewer-list-name {
  flex: 0 0 auto;
}
.viewer-list-name strong {
  white-space: nowrap;
}
.viewer-list-name small,
.viewer-list-facts,
.detail-reading,
.detail-attribution {
  color: var(--color-muted);
  font-size: 12px;
}
.viewer-list-facts {
  flex: 0 1 13rem;
  text-align: right;
}
.back-to-list {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
}
.municipality-detail {
  max-width: 34rem;
  margin: 0 auto;
}
.detail-emblem {
  display: block;
  width: min(180px, 45vw);
  height: 180px;
  margin: 0 auto var(--space-4);
  object-fit: contain;
}
.detail-reading {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65em;
  margin: 0;
}
.municipality-detail h2 {
  margin-bottom: var(--space-5);
  font-size: clamp(26px, 5vw, 36px);
}
.detail-data {
  display: grid;
  gap: 0;
  margin: 0;
  border-top: 1px solid var(--color-border);
}
.detail-data > div {
  display: grid;
  grid-template-columns: minmax(8rem, 0.65fr) 1fr;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}
.detail-data dt {
  color: var(--color-muted);
}
.detail-data dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.detail-shape-image {
  display: block;
  width: min(240px, 72%);
  height: 180px;
  margin: var(--space-6) auto var(--space-4);
  object-fit: contain;
}
.detail-attribution {
  overflow-wrap: anywhere;
}
@media (min-width: 900px) {
  .explore-layout {
    grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
    align-items: start;
  }
}
@media (max-width: 640px) {
  .viewer-list-row {
    align-items: flex-start;
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--space-2);
  }
  .viewer-list-facts {
    flex-basis: auto;
    width: 100%;
    text-align: left;
  }
  .detail-data > div {
    grid-template-columns: 1fr;
    gap: var(--space-1);
  }
}
</style>
