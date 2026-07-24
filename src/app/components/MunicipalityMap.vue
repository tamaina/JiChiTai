<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  nationalPrefecturePaths,
  type GeneratedMapPath,
} from '../../shared/data/generated-national-map'
import {
  municipalityByCode,
  prefectureByCode,
} from '../../shared/data/municipalities'

const props = defineProps<{
  prefectureCode: string | null
  selectedMunicipalityCode: string | null
}>()
const emit = defineEmits<{
  selectPrefecture: [code: string]
  selectMunicipality: [code: string]
}>()

const municipalityPaths = ref<GeneratedMapPath[]>([])
const loading = ref(false)
const loadError = ref('')

watch(
  () => props.prefectureCode,
  async (code, _, onCleanup) => {
    municipalityPaths.value = []
    loadError.value = ''
    loading.value = false
    if (!code) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    loading.value = true
    try {
      const response = await fetch(`/generated/maps/${code}.json`, {
        signal: controller.signal,
      })
      if (!response.ok)
        throw new Error(`Map request failed: ${response.status}`)
      const payload: unknown = await response.json()
      if (
        !Array.isArray(payload) ||
        !payload.every(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as GeneratedMapPath).code === 'string' &&
            typeof (item as GeneratedMapPath).path === 'string',
        )
      )
        throw new Error('Map data is invalid')
      municipalityPaths.value = payload as GeneratedMapPath[]
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        loadError.value = '地図を読み込めませんでした。'
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)

const paths = computed(() =>
  props.prefectureCode ? municipalityPaths.value : nationalPrefecturePaths,
)
const mapLabel = computed(() => {
  if (!props.prefectureCode) return '日本全国の都道府県地図'
  const name = prefectureByCode.get(props.prefectureCode)?.name ?? ''
  return `${name}の市区町村地図`
})

function labelFor(code: string) {
  return props.prefectureCode
    ? municipalityByCode.get(code)?.name
    : prefectureByCode.get(code)?.name
}

function select(code: string) {
  if (props.prefectureCode) emit('selectMunicipality', code)
  else emit('selectPrefecture', code)
}

function selectFromKeyboard(event: KeyboardEvent, code: string) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  select(code)
}
</script>

<template>
  <div class="municipality-map">
    <svg
      :class="{
        'map-national': !prefectureCode,
        'map-has-selection': selectedMunicipalityCode,
      }"
      viewBox="0 0 100 100"
      role="group"
      :aria-label="mapLabel"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        v-for="pathItem in paths"
        :key="pathItem.code"
        :d="pathItem.path"
        class="map-region"
        fill-rule="evenodd"
        :class="[
          `map-region-color-${Number(pathItem.code) % 6}`,
          {
            'map-region-selected': pathItem.code === selectedMunicipalityCode,
          },
        ]"
        role="button"
        tabindex="0"
        :aria-label="`${labelFor(pathItem.code)}を選択`"
        @click="select(pathItem.code)"
        @keydown="selectFromKeyboard($event, pathItem.code)"
      >
        <title>{{ labelFor(pathItem.code) }}</title>
      </path>
    </svg>
    <p v-if="loading" class="map-status" role="status">地図を読み込み中…</p>
    <p v-else-if="loadError" class="map-status map-error" role="alert">
      {{ loadError }}
    </p>
  </div>
</template>

<style scoped>
.municipality-map {
  position: relative;
  width: 100%;
  min-height: 240px;
  display: grid;
  place-items: center;
}
svg {
  display: block;
  width: 100%;
  max-height: min(68vh, 720px);
  overflow: visible;
}
.map-region {
  stroke: var(--color-bg);
  stroke-width: 0.16;
  vector-effect: non-scaling-stroke;
  outline: none !important;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    fill 120ms ease,
    stroke-width 120ms ease;
}
.map-region-color-0 {
  --map-region-fill: #66c7bd;
}
.map-region-color-1 {
  --map-region-fill: #7ab7c9;
}
.map-region-color-2 {
  --map-region-fill: #9fc17a;
}
.map-region-color-3 {
  --map-region-fill: #d2b46c;
}
.map-region-color-4 {
  --map-region-fill: #c99bba;
}
.map-region-color-5 {
  --map-region-fill: #8fb0d1;
}
.map-region {
  fill: var(--map-region-fill);
}
.map-region:hover {
  fill: color-mix(in srgb, var(--map-region-fill) 82%, var(--color-bg));
}
.map-region:focus-visible {
  fill: color-mix(in srgb, var(--map-region-fill) 68%, var(--color-bg));
}
.map-has-selection .map-region:not(.map-region-selected) {
  fill: color-mix(in srgb, var(--color-muted) 18%, var(--color-surface));
  stroke: color-mix(in srgb, var(--color-muted) 55%, transparent);
  stroke-width: 0.24;
}
.map-has-selection .map-region:not(.map-region-selected):hover,
.map-has-selection .map-region:not(.map-region-selected):focus-visible {
  fill: color-mix(in srgb, var(--color-muted) 28%, var(--color-surface));
}
.map-region-selected {
  fill: var(--color-danger);
  stroke: var(--color-bg);
  stroke-width: 0.3;
}
.map-region-selected:hover,
.map-region-selected:focus-visible {
  fill: color-mix(in srgb, var(--color-danger) 82%, var(--color-bg));
}
.map-status {
  position: absolute;
  inset: auto var(--space-3) var(--space-3);
  margin: 0;
  padding: var(--space-2);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-muted);
  text-align: center;
}
.map-error {
  color: var(--color-danger);
}
</style>
