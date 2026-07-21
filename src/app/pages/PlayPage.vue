<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Building2,
  Clock3,
  Copy,
  GraduationCap,
  Keyboard,
  MapPinned,
  Play,
  ScanSearch,
  Share2,
  SlidersHorizontal,
} from '@lucide/vue'
import { createGameSession, replenishQuestions } from '../api/client'
import {
  municipalities,
  municipalityByCode,
  prefectures,
  prefectureShapeUrl,
} from '../../shared/data/municipalities'
import {
  canonicalAnswer,
  isCorrectAnswer,
  isValidPlaceAnswer,
  normalizeRomanInput,
} from '../../shared/game/roman'
import type {
  AnswerHistoryItem,
  GameConfig,
  GameType,
  QuestionPayload,
  RuleMode,
} from '../../shared/types/game'

type Phase =
  'select' | 'loading' | 'countdown' | 'playing' | 'revealed' | 'finished'

const phase = ref<Phase>('select')
const gameType = ref<GameType>('prefecture-from-municipality')
const ruleMode = ref<RuleMode>('timed')
const citiesOnly = ref(false)
const prefectureCode = ref('')
const questions = ref<QuestionPayload[]>([])
const questionIndex = ref(0)
const input = ref('')
const feedback = ref('')
const feedbackKind = ref<'neutral' | 'correct' | 'error'>('neutral')
const history = ref<AnswerHistoryItem[]>([])
const remainingMs = ref(120_000)
const transitioning = ref(false)
const sessionId = ref('')
const nextCursor = ref<number | null>(null)
const totalQuestions = ref(0)
const replenishing = ref(false)
const resultElapsedMs = ref(0)
const shareStatus = ref('')
const resultTextarea = ref<HTMLTextAreaElement | null>(null)
const hoveredHistoryLocationId = ref<string | null>(null)
const pinnedHistoryLocationId = ref<string | null>(null)
const historyLocationPosition = ref({ top: 0, left: 0 })
const historyLocationAbove = ref(false)
const countdownValue = ref(3)
const composing = ref(false)
const virtualKeyboardOpen = ref(false)
let gameStartedAt = 0
let questionStartedAt = 0
let animationFrame = 0
let advanceTimer = 0
let countdownTimer = 0
const countdownBeatMs = 600
const initialQuestionTransitionMs = 600
let maximumVisualViewportHeight = 0

watch(prefectureCode, (code) => {
  if (code && gameType.value === 'prefecture-from-municipality')
    gameType.value = 'municipality-typing'
})

const currentQuestion = computed(
  () => questions.value[questionIndex.value] ?? null,
)
const displayedQuestions = computed(() =>
  questions.value.slice(questionIndex.value, questionIndex.value + 2),
)
const currentRecord = computed(() =>
  currentQuestion.value
    ? municipalityByCode.get(currentQuestion.value.municipalityCode)
    : undefined,
)
const openHistoryLocationId = computed(
  () => pinnedHistoryLocationId.value ?? hoveredHistoryLocationId.value,
)
const openHistoryLocationItem = computed(() =>
  history.value.find((item) => item.questionId === openHistoryLocationId.value),
)
const prefectureOptions = prefectures

function recordForQuestion(question: QuestionPayload) {
  return municipalityByCode.get(question.municipalityCode)
}
const correctCount = computed(
  () => history.value.filter((item) => item.result === 'correct').length,
)
const incorrectCount = computed(
  () => history.value.filter((item) => item.result === 'incorrect').length,
)
const formattedTime = computed(() => {
  const seconds = Math.max(0, Math.ceil(remainingMs.value / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const accuracy = computed(() => {
  const answered = correctCount.value + incorrectCount.value
  return answered === 0 ? 0 : Math.round((correctCount.value / answered) * 100)
})
const gameTypeLabel = computed(() => {
  if (gameType.value === 'prefecture-from-municipality') return '都道府県当て'
  if (gameType.value === 'municipality-from-shape') return '市区町村当て'
  return 'タイピング'
})
const ruleModeLabel = computed(() =>
  ruleMode.value === 'timed' ? '2分アタック' : '練習',
)
const presentedCount = computed(() =>
  Math.max(
    history.value.length,
    Math.min(questionIndex.value + 1, totalQuestions.value),
  ),
)
const completedPrefectureTyping = computed(
  () =>
    ruleMode.value === 'practice' &&
    gameType.value === 'municipality-typing' &&
    Boolean(prefectureCode.value) &&
    totalQuestions.value > 0 &&
    history.value.length === totalQuestions.value &&
    history.value.every((item) => item.result === 'correct'),
)
const formattedResultDuration = computed(() => {
  const totalSeconds = Math.max(0, Math.floor(resultElapsedMs.value / 1000))
  return `${Math.floor(totalSeconds / 60)}分${String(totalSeconds % 60).padStart(2, '0')}秒`
})
const typedCharacterCount = computed(() =>
  history.value.reduce(
    (total, item) =>
      total + (item.enteredRaw === null ? 0 : [...item.enteredRaw].length),
    0,
  ),
)
const resultKpm = computed(() => {
  const elapsedMinutes = resultElapsedMs.value / 60_000
  return elapsedMinutes > 0
    ? Math.round(typedCharacterCount.value / elapsedMinutes)
    : 0
})
const resultWpm = computed(() => Math.round((resultKpm.value / 5) * 10) / 10)
const typingMetricsText = computed(
  () =>
    `入力: ${typedCharacterCount.value}文字 / ${formattedResultDuration.value} / ${resultKpm.value} KPM / ${resultWpm.value} WPM`,
)
const resultText = computed(() => {
  if (completedPrefectureTyping.value) {
    const prefectureName = prefectureOptions.find(
      (item) => item.code === prefectureCode.value,
    )?.name
    const scope = citiesOnly.value
      ? '全市'
      : prefectureCode.value === '13'
        ? '全市区町村'
        : '全市町村'
    return `#JiChiTai ${prefectureName ?? ''}${scope} タイピング\n結果: ${formattedResultDuration.value}\n${typingMetricsText.value}\n\nhttps://jichitai.aqz.workers.dev`
  }
  return `#JiChiTai ${gameTypeLabel.value} ${ruleModeLabel.value}\n結果: 正答${correctCount.value}問/誤答${incorrectCount.value}問/出題${presentedCount.value}問 (正答率${accuracy.value}%)\n${typingMetricsText.value}\n\nhttps://jichitai.aqz.workers.dev`
})
const canShare = computed(
  () =>
    typeof navigator !== 'undefined' && typeof navigator.share === 'function',
)
const answerLabel = computed(() =>
  gameType.value === 'prefecture-from-municipality'
    ? '都道府県 ローマ字入力'
    : '都道府県+市区町村 ローマ字入力',
)

function focusInput() {
  void nextTick(() =>
    document
      .querySelector<HTMLInputElement>(
        '.question:not(.question-slide-leave-active) .answer-input',
      )
      ?.focus(),
  )
}

function tick(now: number) {
  if (
    (phase.value !== 'playing' && phase.value !== 'revealed') ||
    ruleMode.value !== 'timed'
  )
    return
  remainingMs.value = Math.max(0, 120_000 - (now - gameStartedAt))
  if (remainingMs.value === 0) {
    finishGame(true)
    return
  }
  animationFrame = requestAnimationFrame(tick)
}

async function startGame() {
  window.clearTimeout(countdownTimer)
  phase.value = 'loading'
  feedback.value = ''
  history.value = []
  questionIndex.value = 0
  input.value = ''
  resultElapsedMs.value = 0
  shareStatus.value = ''
  hoveredHistoryLocationId.value = null
  pinnedHistoryLocationId.value = null
  try {
    const config: GameConfig = {
      gameType: gameType.value,
      ruleMode: ruleMode.value,
      citiesOnly: citiesOnly.value,
      prefectureCode: prefectureCode.value || null,
    }
    const session = await createGameSession(config)
    questions.value = session.questions
    sessionId.value = session.sessionId
    nextCursor.value = session.nextCursor
    totalQuestions.value = session.totalQuestions
    remainingMs.value = session.durationMs
    transitioning.value = false
    startCountdown()
  } catch {
    phase.value = 'select'
    feedbackKind.value = 'error'
    feedback.value = '問題を取得できませんでした。もう一度お試しください。'
  }
}

function beginGameplay() {
  phase.value = 'playing'
  transitioning.value = true
  countdownTimer = window.setTimeout(() => {
    transitioning.value = false
    gameStartedAt = performance.now()
    questionStartedAt = gameStartedAt
    if (ruleMode.value === 'timed') animationFrame = requestAnimationFrame(tick)
    focusInput()
  }, initialQuestionTransitionMs)
}

function startCountdown() {
  phase.value = 'countdown'
  countdownValue.value = 3
  const advanceCountdown = () => {
    if (countdownValue.value > 1) {
      countdownValue.value -= 1
      countdownTimer = window.setTimeout(advanceCountdown, countdownBeatMs)
      return
    }
    beginGameplay()
  }
  countdownTimer = window.setTimeout(advanceCountdown, countdownBeatMs)
}

function addHistory(
  result: AnswerHistoryItem['result'],
  enteredRaw: string | null,
) {
  const question = currentQuestion.value
  const record = currentRecord.value
  if (!question || !record) return
  history.value.push({
    questionId: question.questionId,
    municipalityCode: question.municipalityCode,
    prefectureCode: question.prefectureCode,
    shapeUrl: question.shapeUrl,
    municipalityName: record.name,
    prefectureName: record.prefecture.name,
    districtName: record.districtName,
    placeReading: record.kana,
    expectedCanonical: canonicalAnswer(record, gameType.value),
    enteredRaw,
    enteredNormalized:
      enteredRaw === null ? null : normalizeRomanInput(enteredRaw),
    result,
    elapsedMs: Math.round(performance.now() - questionStartedAt),
    answeredAt: new Date().toISOString(),
  })
}

function scheduleNextQuestion(delayMs = 500) {
  transitioning.value = true
  window.clearTimeout(advanceTimer)
  advanceTimer = window.setTimeout(() => void nextQuestion(), delayMs)
}

function submitAnswer() {
  if (
    composing.value ||
    phase.value !== 'playing' ||
    transitioning.value ||
    !currentRecord.value
  )
    return
  const raw = input.value
  if (!normalizeRomanInput(raw)) return

  if (!isValidPlaceAnswer(gameType.value, raw)) {
    feedbackKind.value = 'error'
    feedback.value = '登録されている地名として認識できません。'
    focusInput()
    return
  }

  if (isCorrectAnswer(currentRecord.value, gameType.value, raw)) {
    addHistory('correct', raw)
    input.value = ''
    if (ruleMode.value === 'timed') {
      feedback.value = ''
      nextQuestion()
      return
    }
    feedbackKind.value = 'correct'
    feedback.value = `正解 — ${currentRecord.value.prefecture.name}${currentRecord.value.name}`
    phase.value = 'revealed'
    scheduleNextQuestion(1_050)
    return
  }

  feedbackKind.value = 'error'
  feedback.value = '不正解です。'
  if (ruleMode.value === 'timed') {
    addHistory('incorrect', raw)
    input.value = ''
    feedback.value = ''
    nextQuestion()
  } else {
    focusInput()
  }
}

function updateVirtualKeyboardState() {
  const viewport = window.visualViewport
  if (!viewport) return
  const inputFocused =
    document.activeElement?.classList.contains('answer-input')
  if (!inputFocused) {
    maximumVisualViewportHeight = viewport.height
    virtualKeyboardOpen.value = false
    return
  }
  maximumVisualViewportHeight = Math.max(
    maximumVisualViewportHeight,
    viewport.height,
  )
  virtualKeyboardOpen.value =
    maximumVisualViewportHeight - viewport.height > 120
}

function revealAnswer() {
  if (
    phase.value !== 'playing' ||
    ruleMode.value !== 'practice' ||
    !currentRecord.value
  )
    return
  addHistory('revealed', null)
  input.value = canonicalAnswer(currentRecord.value, gameType.value)
  feedbackKind.value = 'neutral'
  feedback.value = `答え：${currentRecord.value.prefecture.name}${currentRecord.value.name}`
  phase.value = 'revealed'
}

async function prefetchQuestions() {
  if (replenishing.value || nextCursor.value === null) return
  replenishing.value = true
  try {
    const batch = await replenishQuestions(
      sessionId.value,
      gameType.value,
      citiesOnly.value,
      prefectureCode.value || null,
      nextCursor.value,
    )
    questions.value.push(...batch.questions)
    nextCursor.value = batch.nextCursor
  } finally {
    replenishing.value = false
  }
}

function nextQuestion() {
  if (questionIndex.value + 1 >= questions.value.length) {
    finishGame(false)
    return
  }
  questionIndex.value += 1
  if (questions.value.length - questionIndex.value <= 3)
    void prefetchQuestions()
  questionStartedAt = performance.now()
  input.value = ''
  feedback.value = ''
  feedbackKind.value = 'neutral'
  phase.value = 'playing'
  transitioning.value = false
  focusInput()
}

function finishGame(timedOut = false) {
  cancelAnimationFrame(animationFrame)
  window.clearTimeout(advanceTimer)
  if (timedOut && currentQuestion.value && phase.value === 'playing')
    addHistory('timeout', null)
  const recordedElapsedMs = history.value.reduce(
    (total, item) => total + item.elapsedMs,
    0,
  )
  const currentQuestionWasRecorded =
    history.value.at(-1)?.questionId === currentQuestion.value?.questionId
  const activeElapsedMs =
    phase.value === 'playing' && !currentQuestionWasRecorded
      ? Math.max(0, Math.round(performance.now() - questionStartedAt))
      : 0
  resultElapsedMs.value = recordedElapsedMs + activeElapsedMs
  phase.value = 'finished'
}

async function copyResult() {
  try {
    if (navigator.clipboard)
      await navigator.clipboard.writeText(resultText.value)
    else {
      resultTextarea.value?.select()
      document.execCommand('copy')
    }
    shareStatus.value = '結果をコピーしました。'
  } catch {
    shareStatus.value =
      'コピーできませんでした。テキストを選択してコピーしてください。'
  }
}

async function shareResult() {
  if (!canShare.value) return
  try {
    await navigator.share({ text: resultText.value })
    shareStatus.value = '共有しました。'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    shareStatus.value = '共有できませんでした。'
  }
}

function resetGame() {
  cancelAnimationFrame(animationFrame)
  window.clearTimeout(advanceTimer)
  window.clearTimeout(countdownTimer)
  phase.value = 'select'
  history.value = []
  feedback.value = ''
  shareStatus.value = ''
  hoveredHistoryLocationId.value = null
  pinnedHistoryLocationId.value = null
}

function positionHistoryLocation(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  const previewWidth = Math.min(240, window.innerWidth - 32)
  const previewHeight = previewWidth + 52
  historyLocationAbove.value =
    rect.bottom + 8 + previewHeight > window.innerHeight
  const viewportTop = historyLocationAbove.value
    ? rect.top - 8
    : rect.bottom + 8
  const viewportLeft = Math.min(
    Math.max(16, rect.left),
    window.innerWidth - previewWidth - 16,
  )
  historyLocationPosition.value = {
    top: viewportTop + window.scrollY,
    left: viewportLeft + window.scrollX,
  }
}

function showHistoryLocation(questionId: string, target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return
  positionHistoryLocation(target)
  hoveredHistoryLocationId.value = questionId
}

function hideHistoryLocation(questionId: string) {
  if (hoveredHistoryLocationId.value === questionId)
    hoveredHistoryLocationId.value = null
}

function toggleHistoryLocation(questionId: string, target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return
  positionHistoryLocation(target)
  hoveredHistoryLocationId.value = null
  pinnedHistoryLocationId.value =
    pinnedHistoryLocationId.value === questionId ? null : questionId
}

onMounted(() => {
  maximumVisualViewportHeight =
    window.visualViewport?.height ?? window.innerHeight
  window.visualViewport?.addEventListener('resize', updateVirtualKeyboardState)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  window.clearTimeout(advanceTimer)
  window.clearTimeout(countdownTimer)
  window.visualViewport?.removeEventListener(
    'resize',
    updateVirtualKeyboardState,
  )
})
</script>

<template>
  <section
    v-if="phase === 'select' || phase === 'loading'"
    class="page-section game-select"
  >
    <p class="eyebrow">ゲーム</p>
    <h1>モードを選ぶ</h1>
    <section
      class="selection-group filter-section"
      aria-labelledby="filter-heading"
    >
      <div class="selection-panel filter-panel">
        <h2 id="filter-heading" class="selection-heading">
          <SlidersHorizontal :size="18" /> フィルタ
        </h2>
        <div class="filter-controls">
          <label class="select-control">
            <span><MapPinned :size="17" /> 都道府県</span>
            <select v-model="prefectureCode">
              <option value="">全国</option>
              <option
                v-for="prefecture in prefectureOptions"
                :key="prefecture.code"
                :value="prefecture.code"
              >
                {{ prefecture.name }}
              </option>
            </select>
          </label>
          <label class="filter-toggle">
            <input v-model="citiesOnly" type="checkbox" />
            <Building2 :size="18" />
            <span>市のみ出題</span>
          </label>
        </div>
      </div>
    </section>
    <fieldset class="selection-group">
      <legend>出題方法</legend>
      <div class="mode-card-grid">
        <label class="choice-card">
          <input
            v-model="gameType"
            type="radio"
            value="prefecture-from-municipality"
            :disabled="Boolean(prefectureCode)"
            aria-label="都道府県当て"
          />
          <MapPinned class="choice-icon" :size="24" />
          <span class="choice-copy">
            <strong>都道府県当て</strong>
            <small>市区町村名と形から都道府県を回答</small>
          </span>
        </label>
        <label class="choice-card">
          <input
            v-model="gameType"
            type="radio"
            value="municipality-from-shape"
            aria-label="市区町村当て"
          />
          <ScanSearch class="choice-icon" :size="24" />
          <span class="choice-copy">
            <strong>市区町村当て</strong>
            <small>輪郭だけを見て自治体名まで回答</small>
          </span>
        </label>
        <label class="choice-card">
          <input
            v-model="gameType"
            type="radio"
            value="municipality-typing"
            aria-label="タイピング"
          />
          <Keyboard class="choice-icon" :size="24" />
          <span class="choice-copy">
            <strong>タイピング</strong>
            <small>表示された漢字と読みをそのまま入力</small>
          </span>
        </label>
      </div>
    </fieldset>
    <fieldset class="selection-group">
      <legend>ルール</legend>
      <div class="rule-card-grid">
        <label class="choice-card choice-card-compact">
          <input
            v-model="ruleMode"
            type="radio"
            value="timed"
            aria-label="2分アタック"
          />
          <Clock3 class="choice-icon" :size="22" />
          <span class="choice-copy">
            <strong>2分アタック</strong><small>テンポよくスコアに挑戦</small>
          </span>
        </label>
        <label class="choice-card choice-card-compact">
          <input
            v-model="ruleMode"
            type="radio"
            value="practice"
            aria-label="練習"
          />
          <GraduationCap class="choice-icon" :size="22" />
          <span class="choice-copy">
            <strong>練習</strong><small>答えを確認しながら学習</small>
          </span>
        </label>
      </div>
    </fieldset>
    <button
      class="button button-primary start-button"
      type="button"
      :disabled="phase === 'loading'"
      @click="startGame"
    >
      <Play v-if="phase !== 'loading'" :size="19" fill="currentColor" />
      {{ phase === 'loading' ? '問題を準備中…' : '開始する' }}
    </button>
    <p class="feedback" :data-kind="feedbackKind" role="status">
      {{ feedback }}
    </p>
    <p class="dataset-note">
      全国{{
        municipalities.length.toLocaleString('ja-JP')
      }}自治体の実際の境界形状で遊べます。
    </p>
  </section>

  <div v-else-if="phase !== 'finished'" class="game-start-stage">
    <section
      class="game-screen"
      :class="{
        'game-screen-timed': ruleMode === 'timed',
        'game-screen-waiting': phase === 'countdown',
        'game-screen-starting': phase === 'playing' && transitioning,
        'game-screen-keyboard-open': virtualKeyboardOpen,
      }"
      aria-label="タイピングゲーム"
      :aria-hidden="phase === 'countdown'"
      :inert="phase === 'countdown'"
    >
      <header class="game-status">
        <span>{{
          ruleMode === 'timed' ? `残り ${formattedTime}` : '練習中'
        }}</span>
        <template v-if="ruleMode === 'practice'">
          <span>正解 {{ correctCount }}</span>
          <span>{{ questionIndex + 1 }} / {{ totalQuestions }}</span>
        </template>
      </header>

      <TransitionGroup
        name="question-slide"
        tag="div"
        class="question-stage"
        @after-enter="focusInput"
      >
        <div
          v-for="question in displayedQuestions"
          :key="question.questionId"
          class="question"
          :class="{
            'question-current':
              question.questionId === currentQuestion?.questionId,
            'question-next':
              question.questionId !== currentQuestion?.questionId,
          }"
          :aria-hidden="question.questionId !== currentQuestion?.questionId"
          :inert="question.questionId !== currentQuestion?.questionId"
        >
          <p
            v-if="gameType !== 'municipality-from-shape'"
            class="municipality-name"
          >
            <span class="place-name-parts">
              <span
                v-if="gameType === 'municipality-typing'"
                class="place-name-part"
              >
                {{ recordForQuestion(question)?.prefecture.name }}
              </span>
              <span class="place-name-part">
                {{ question.municipalityDisplayName }}
              </span>
            </span>
            <small
              v-if="
                gameType === 'municipality-typing' ||
                gameType === 'prefecture-from-municipality'
              "
            >
              <span
                v-if="recordForQuestion(question)?.districtName"
                class="reading-part"
              >
                {{ recordForQuestion(question)?.districtName }}
              </span>
              <span class="reading-part">
                {{ recordForQuestion(question)?.kana }}
              </span>
            </small>
          </p>
          <p v-else class="question-prompt">この形の自治体は？</p>
          <div class="shape-frame" aria-hidden="true">
            <div class="shape-slide-item">
              <img
                class="question-prefecture-preload"
                :src="prefectureShapeUrl(question.prefectureCode)"
                alt=""
                aria-hidden="true"
              />
              <img
                class="municipality-shape-image"
                :class="{
                  'municipality-shape-placing':
                    ruleMode === 'practice' &&
                    phase === 'revealed' &&
                    question.questionId === currentQuestion?.questionId,
                }"
                :src="question.shapeUrl"
                :style="{
                  '--placement-to':
                    recordForQuestion(question)?.placementTransform,
                }"
                :alt="
                  phase === 'revealed'
                    ? recordForQuestion(question)?.name
                    : '市区町村の形'
                "
              />
              <template
                v-if="
                  ruleMode === 'practice' &&
                  phase === 'revealed' &&
                  question.questionId === currentQuestion?.questionId
                "
              >
                <img
                  class="prefecture-placement-image"
                  :src="prefectureShapeUrl(question.prefectureCode)"
                  alt=""
                />
              </template>
            </div>
          </div>
          <form class="answer-form" @submit.prevent="submitAnswer">
            <label class="answer-label" :for="`answer-${question.questionId}`">
              {{ answerLabel }}
            </label>
            <input
              :id="`answer-${question.questionId}`"
              v-model="input"
              class="answer-input"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              enterkeyhint="done"
              spellcheck="false"
              :disabled="phase !== 'playing' || transitioning"
              @compositionstart="composing = true"
              @compositionend="composing = false"
            />
            <p class="input-help">入力後に Enter</p>
          </form>
          <p class="feedback" :data-kind="feedbackKind" aria-live="polite">
            {{ feedback }}
          </p>
          <div class="secondary-actions">
            <button
              v-if="ruleMode === 'practice' && phase === 'playing'"
              type="button"
              class="text-button"
              @click="revealAnswer"
            >
              答えを見る
            </button>
            <button
              v-if="ruleMode === 'practice' && phase === 'revealed'"
              type="button"
              class="button"
              @click="nextQuestion"
            >
              次の問題
            </button>
            <button
              v-if="ruleMode === 'practice'"
              type="button"
              class="text-button"
              @click="finishGame(false)"
            >
              練習を終了
            </button>
            <button
              v-else
              type="button"
              class="text-button"
              @click="finishGame(false)"
            >
              ゲームを中止
            </button>
          </div>
        </div>
      </TransitionGroup>
    </section>

    <section
      v-if="phase === 'countdown'"
      class="countdown-screen"
      aria-label="ゲーム開始までのカウントダウン"
    >
      <p>READY</p>
      <div class="countdown-stage" aria-live="assertive" aria-atomic="true">
        <TransitionGroup name="countdown-slide" appear>
          <strong :key="countdownValue" class="countdown-number">
            {{ countdownValue }}
          </strong>
        </TransitionGroup>
      </div>
    </section>
  </div>

  <section v-else class="page-section result-screen">
    <p class="eyebrow">結果</p>
    <h1>{{ correctCount }}問正解</h1>
    <p class="result-summary">
      誤答 {{ incorrectCount }}問・正答率 {{ accuracy }}%
    </p>
    <div class="result-actions">
      <button class="button button-primary" type="button" @click="startGame">
        もう一度遊ぶ
      </button>
      <button class="button" type="button" @click="resetGame">
        モード選択へ戻る
      </button>
    </div>
    <section class="result-share" aria-labelledby="result-share-heading">
      <h2 id="result-share-heading">結果を共有</h2>
      <label class="sr-only" for="result-share-text"
        >共有用の結果テキスト</label
      >
      <textarea
        id="result-share-text"
        ref="resultTextarea"
        :value="resultText"
        rows="4"
        readonly
      ></textarea>
      <div class="result-share-actions">
        <button class="button" type="button" @click="copyResult">
          <Copy :size="18" />
          コピー
        </button>
        <button
          v-if="canShare"
          class="button button-primary"
          type="button"
          @click="shareResult"
        >
          <Share2 :size="18" />
          共有
        </button>
      </div>
      <p class="share-status" aria-live="polite">{{ shareStatus }}</p>
    </section>
    <h2>回答履歴</h2>
    <div class="history-table-wrap">
      <table>
        <thead>
          <tr>
            <th aria-label="形"></th>
            <th>問題</th>
            <th>入力</th>
            <th>結果</th>
            <th>時間</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in history"
            :key="item.questionId"
            class="history-row"
          >
            <td class="history-shape-cell">
              <button
                type="button"
                class="history-location-trigger history-shape-button"
                :aria-expanded="pinnedHistoryLocationId === item.questionId"
                :aria-controls="`history-location-${item.questionId}`"
                :aria-label="`${item.prefectureName}内での${item.municipalityName}の位置を表示`"
                @mouseenter="
                  showHistoryLocation(item.questionId, $event.currentTarget)
                "
                @mouseleave="hideHistoryLocation(item.questionId)"
                @focus="
                  showHistoryLocation(item.questionId, $event.currentTarget)
                "
                @blur="hideHistoryLocation(item.questionId)"
                @click="
                  toggleHistoryLocation(item.questionId, $event.currentTarget)
                "
              >
                <img
                  class="history-shape"
                  :src="item.shapeUrl"
                  :alt="`${item.municipalityName}の形`"
                  loading="lazy"
                />
              </button>
            </td>
            <td class="history-question-cell">
              <button
                type="button"
                class="history-location-trigger history-question-button"
                :aria-expanded="pinnedHistoryLocationId === item.questionId"
                :aria-controls="`history-location-${item.questionId}`"
                @mouseenter="
                  showHistoryLocation(item.questionId, $event.currentTarget)
                "
                @mouseleave="hideHistoryLocation(item.questionId)"
                @focus="
                  showHistoryLocation(item.questionId, $event.currentTarget)
                "
                @blur="hideHistoryLocation(item.questionId)"
                @click="
                  toggleHistoryLocation(item.questionId, $event.currentTarget)
                "
              >
                {{ item.prefectureName }}{{ item.municipalityName }}
                <small>
                  <span v-if="item.districtName">{{ item.districtName }}</span>
                  {{ item.placeReading }}
                </small>
              </button>
            </td>
            <td>
              <code>{{ item.enteredRaw ?? '—' }}</code
              ><small>{{ item.expectedCanonical }}</small>
            </td>
            <td>
              {{
                item.result === 'correct'
                  ? '正解'
                  : item.result === 'incorrect'
                    ? '誤答'
                    : item.result === 'revealed'
                      ? '回答表示'
                      : '時間切れ'
              }}
            </td>
            <td>{{ (item.elapsedMs / 1000).toFixed(1) }}秒</td>
          </tr>
        </tbody>
      </table>
    </div>
    <Teleport to="body">
      <button
        v-if="pinnedHistoryLocationId"
        type="button"
        class="history-location-backdrop"
        aria-label="位置表示を閉じる"
        @click="pinnedHistoryLocationId = null"
      ></button>
      <div
        v-if="openHistoryLocationItem"
        :id="`history-location-${openHistoryLocationItem.questionId}`"
        class="history-location-preview"
        role="img"
        :aria-label="`${openHistoryLocationItem.municipalityName}の${openHistoryLocationItem.prefectureName}内での位置`"
        :style="{
          top: `${historyLocationPosition.top}px`,
          left: `${historyLocationPosition.left}px`,
          transform: historyLocationAbove ? 'translateY(-100%)' : undefined,
        }"
        @click.stop
      >
        <div class="history-location-map" aria-hidden="true">
          <img
            class="history-prefecture-shape"
            :src="prefectureShapeUrl(openHistoryLocationItem.prefectureCode)"
            alt=""
          />
          <img
            class="history-municipality-placement"
            :src="openHistoryLocationItem.shapeUrl"
            alt=""
            :style="{
              '--placement-to': municipalityByCode.get(
                openHistoryLocationItem.municipalityCode,
              )?.placementTransform,
            }"
          />
        </div>
        <span>{{ openHistoryLocationItem.prefectureName }}内の位置</span>
      </div>
    </Teleport>
  </section>
</template>
