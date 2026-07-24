<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, RotateCcw, Upload } from '@lucide/vue'
import {
  municipalities,
  municipalityShapeUrl,
} from '../../shared/data/municipalities'
import {
  ratingOptions,
  reviewCardId,
  reviewModes,
  reviewModeStats,
  scheduleReview,
  schedulingPreview,
  selectReviewMunicipalities,
  type ReviewMode,
  type StoredReviewCard,
} from '../../shared/review/fsrs'
import {
  createReviewExport,
  getAllReviewCards,
  parseReviewExport,
  putReviewCard,
  replaceReviewCards,
} from '../storage/review-storage'

type Phase = 'select' | 'reviewing' | 'finished'
type SessionSize = 'twenty' | 'cram'

const SESSION_SIZE = 20
const phase = ref<Phase>('select')
const selectedMode = ref<ReviewMode>('prefecture-from-municipality')
const sessionSize = ref<SessionSize>('twenty')
const storedCards = ref<StoredReviewCard[]>([])
const queue = ref<typeof municipalities>([])
const currentIndex = ref(0)
const answerVisible = ref(false)
const saving = ref(false)
const loading = ref(true)
const statusMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const currentRecord = computed(() => queue.value[currentIndex.value] ?? null)
const currentStoredCard = computed(() => {
  const record = currentRecord.value
  return record
    ? storedCards.value.find(
        (card) => card.id === reviewCardId(selectedMode.value, record.code),
      )
    : undefined
})
const currentAreaCodeMunicipalities = computed(() => {
  const areaCode = currentRecord.value?.primaryAreaCode
  if (selectedMode.value !== 'municipality-from-area-code' || !areaCode)
    return []
  return municipalities.filter((record) => record.areaCodes.includes(areaCode))
})
const stats = computed(() =>
  reviewModeStats(municipalities, storedCards.value, selectedMode.value),
)
const preview = computed(() =>
  schedulingPreview(currentStoredCard.value, new Date()),
)

onMounted(async () => {
  try {
    storedCards.value = await getAllReviewCards()
  } catch {
    statusMessage.value = 'この端末の学習履歴を読み込めませんでした。'
  } finally {
    loading.value = false
  }
})

function startReview() {
  queue.value = selectReviewMunicipalities(
    municipalities,
    storedCards.value,
    selectedMode.value,
    new Date(),
    sessionSize.value === 'cram' ? null : SESSION_SIZE,
  )
  currentIndex.value = 0
  answerVisible.value = false
  phase.value = queue.value.length ? 'reviewing' : 'finished'
}

async function rate(rating: (typeof ratingOptions)[number]['rating']) {
  const record = currentRecord.value
  if (!record || saving.value) return
  saving.value = true
  try {
    const updated = scheduleReview(
      currentStoredCard.value,
      selectedMode.value,
      record.code,
      rating,
      new Date(),
    )
    await putReviewCard(updated)
    const previousIndex = storedCards.value.findIndex(
      (card) => card.id === updated.id,
    )
    if (previousIndex === -1) storedCards.value.push(updated)
    else storedCards.value.splice(previousIndex, 1, updated)
    if (currentIndex.value + 1 >= queue.value.length) phase.value = 'finished'
    else {
      currentIndex.value += 1
      answerVisible.value = false
    }
  } catch {
    statusMessage.value = '評価を保存できませんでした。'
  } finally {
    saving.value = false
  }
}

function resetReview() {
  phase.value = 'select'
  queue.value = []
  currentIndex.value = 0
  answerVisible.value = false
}

function previewText(rating: (typeof ratingOptions)[number]['rating']) {
  const milliseconds = preview.value[rating].card.due.getTime() - Date.now()
  const minutes = Math.max(1, Math.round(milliseconds / 60_000))
  if (minutes < 60) return `${minutes}分後`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}時間後`
  return `${Math.round(hours / 24)}日後`
}

async function exportHistory() {
  const cards = await getAllReviewCards()
  const json = JSON.stringify(createReviewExport(cards), null, 2)
  const url = URL.createObjectURL(
    new Blob([json], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `jichitai-fsrs-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  statusMessage.value = `${cards.length}件の学習履歴を書き出しました。`
}

function selectImportFile() {
  fileInput.value?.click()
}

async function importHistory(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const shouldReplace = window.confirm(
    '現在の学習履歴を、選択したJSONの内容で置き換えますか？',
  )
  if (!shouldReplace) {
    statusMessage.value = '読み込みをキャンセルしました。'
    return
  }
  try {
    const parsed = parseReviewExport(JSON.parse(await file.text()))
    await replaceReviewCards(parsed.cards)
    storedCards.value = parsed.cards
    resetReview()
    statusMessage.value = `${parsed.cards.length}件の学習履歴に置き換えました。`
  } catch (error) {
    statusMessage.value =
      error instanceof Error
        ? error.message
        : '学習履歴を読み込めませんでした。'
  }
}
</script>

<template>
  <section class="page-section review-page">
    <p class="eyebrow">間隔反復</p>

    <template v-if="phase === 'select'">
      <h1>FSRS暗記モード</h1>
      <p class="lead">
        答えを確認して4段階で自己評価します。学習間隔と履歴は、この端末に出題方式ごとに保存されます。
      </p>

      <fieldset class="selection-group">
        <legend>出題方法</legend>
        <div class="mode-card-grid">
          <label
            v-for="mode in reviewModes"
            :key="mode.id"
            class="choice-card review-mode-card"
          >
            <input v-model="selectedMode" type="radio" :value="mode.id" />
            <span class="choice-copy">
              <strong>{{ mode.name }}</strong>
              <small>{{ mode.description }}</small>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset class="selection-group">
        <legend>出題数</legend>
        <div class="rule-card-grid">
          <label class="choice-card choice-card-compact">
            <input v-model="sessionSize" type="radio" value="twenty" />
            <span class="choice-copy">
              <strong>通常モード</strong>
              <small>シャッフルしたカードから最大20枚</small>
            </span>
          </label>
          <label class="choice-card choice-card-compact">
            <input v-model="sessionSize" type="radio" value="cram" />
            <span class="choice-copy">
              <strong>詰め込みモード</strong>
              <small>復習期限と未学習の全カードを出題</small>
            </span>
          </label>
        </div>
      </fieldset>

      <div class="review-stats" aria-live="polite">
        <div>
          <strong>{{ stats.due }}</strong
          ><span>復習期限</span>
        </div>
        <div>
          <strong>{{ stats.learned }}</strong
          ><span>学習済み</span>
        </div>
        <div>
          <strong>{{ stats.total }}</strong
          ><span>対象カード</span>
        </div>
      </div>

      <button
        class="button button-primary start-button"
        type="button"
        :disabled="loading"
        @click="startReview"
      >
        {{
          loading
            ? '履歴を読み込み中…'
            : sessionSize === 'cram'
              ? '対象カードをすべて学習する'
              : '最大20枚を学習する'
        }}
      </button>

      <section class="review-data-panel" aria-labelledby="review-data-heading">
        <h2 id="review-data-heading">学習履歴の引き継ぎ</h2>
        <p>
          JSONを書き出して保管できます。読み込みは、確認後に現在の履歴をすべて置き換えます。
        </p>
        <div class="review-data-actions">
          <button class="button" type="button" @click="exportHistory">
            <Download :size="18" /> JSONを書き出す
          </button>
          <button class="button" type="button" @click="selectImportFile">
            <Upload :size="18" /> JSONを読み込む
          </button>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept="application/json,.json"
            @change="importHistory"
          />
        </div>
      </section>
    </template>

    <template v-else-if="phase === 'reviewing' && currentRecord">
      <header class="review-progress">
        <span>{{ currentIndex + 1 }} / {{ queue.length }}</span>
        <button class="text-button" type="button" @click="resetReview">
          学習を終了
        </button>
      </header>

      <article class="review-card" :data-mode="selectedMode">
        <p class="question-prompt">
          {{
            reviewModes.find((mode) => mode.id === selectedMode)?.description
          }}
        </p>

        <div class="review-card-front">
          <img
            v-if="selectedMode === 'municipality-from-shape'"
            class="review-shape"
            :src="municipalityShapeUrl(currentRecord.code)"
            alt="出題する自治体の輪郭"
          />
          <img
            v-else-if="
              selectedMode === 'prefecture-from-emblem' && currentRecord.emblem
            "
            class="review-emblem"
            :src="currentRecord.emblem.imageUrl"
            alt="出題する市区町村章"
          />
          <h1 v-else>
            <template v-if="selectedMode === 'prefecture-from-municipality'">
              {{ currentRecord.name }}
            </template>
            <template
              v-else-if="selectedMode === 'municipality-from-area-code'"
            >
              {{ currentRecord.primaryAreaCode }}
            </template>
            <template v-else>
              {{ currentRecord.prefecture.name }}{{ currentRecord.name }}
            </template>
          </h1>
        </div>

        <button
          v-if="!answerVisible"
          class="button button-primary review-reveal"
          type="button"
          @click="answerVisible = true"
        >
          答えを見る
        </button>

        <div v-else class="review-answer" aria-live="polite">
          <p class="review-answer-label">答え</p>
          <h2 v-if="selectedMode === 'prefecture-from-municipality'">
            {{ currentRecord.prefecture.name }}
          </h2>
          <h2 v-else-if="selectedMode === 'area-code-from-municipality'">
            {{ currentRecord.primaryAreaCode }}
            <small v-if="currentRecord.areaCodes.length > 1">
              （ほか {{ currentRecord.areaCodes.slice(1).join('、') }}）
            </small>
          </h2>
          <template v-else-if="selectedMode === 'municipality-from-area-code'">
            <h2>該当する自治体</h2>
            <ul class="review-area-code-municipalities">
              <li
                v-for="record in currentAreaCodeMunicipalities"
                :key="record.code"
              >
                {{ record.prefecture.name }}{{ record.name }}
              </li>
            </ul>
          </template>
          <h2 v-else>
            {{ currentRecord.prefecture.name }}{{ currentRecord.name }}
          </h2>
          <p v-if="selectedMode !== 'municipality-from-area-code'">
            {{ currentRecord.kana }}
            <template v-if="currentRecord.postalCodePrefixes.length">
              ／ 郵便番号上2桁
              {{ currentRecord.postalCodePrefixes.join('・') }}
            </template>
          </p>
          <p
            v-if="
              selectedMode === 'prefecture-from-emblem' && currentRecord.emblem
            "
            class="asset-attribution"
          >
            出典:
            <a
              :href="currentRecord.emblem.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              >{{ currentRecord.emblem.author }}</a
            >
            ({{ currentRecord.emblem.licenseName }})
          </p>

          <fieldset class="review-rating">
            <legend>どのくらい思い出せましたか？</legend>
            <button
              v-for="option in ratingOptions"
              :key="option.rating"
              class="button review-rating-button"
              :data-rating="option.rating"
              type="button"
              :disabled="saving"
              @click="rate(option.rating)"
            >
              <strong>{{ option.label }}</strong>
              <small>{{ previewText(option.rating) }}</small>
            </button>
          </fieldset>
        </div>
      </article>
    </template>

    <template v-else>
      <h1>今回の学習は完了です</h1>
      <p class="lead">
        {{
          queue.length
            ? `${queue.length}枚の学習履歴を保存しました。`
            : 'この出題方法には、いま復習するカードも新しいカードもありません。'
        }}
      </p>
      <button class="button button-primary" type="button" @click="resetReview">
        <RotateCcw :size="18" /> 学習方法を選ぶ
      </button>
    </template>

    <p v-if="statusMessage" class="feedback" role="status">
      {{ statusMessage }}
    </p>
  </section>
</template>
