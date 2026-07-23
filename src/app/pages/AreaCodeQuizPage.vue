<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftRight, Phone, Play } from '@lucide/vue'
import {
  municipalities,
  prefectures,
  type MunicipalityRecord,
} from '../../shared/data/municipalities'
import { populationTop1000MunicipalityCodes } from '../../shared/data/population-top-1000'
import {
  isCorrectAreaCode,
  municipalityChoices,
  normalizeAreaCodeInput,
  shuffled,
  type AreaCodeQuizType,
} from '../../shared/game/area-code'
import type { MunicipalityFilter } from '../../shared/types/game'

type Phase = 'select' | 'playing' | 'finished'

interface QuizQuestion {
  record: MunicipalityRecord
  areaCode: string
  choices: MunicipalityRecord[]
}

const phase = ref<Phase>('select')
const quizType = ref<AreaCodeQuizType>('area-code-from-municipality')
const municipalityFilter = ref<MunicipalityFilter>('all')
const prefectureCode = ref('')
const questions = ref<QuizQuestion[]>([])
const questionIndex = ref(0)
const answer = ref('')
const answered = ref(false)
const correct = ref(false)
const score = ref(0)

const eligibleMunicipalities = computed(() =>
  municipalities.filter(
    (record) =>
      record.areaCodes.length > 0 &&
      (!prefectureCode.value ||
        record.prefectureCode === prefectureCode.value) &&
      (municipalityFilter.value === 'all' ||
        (municipalityFilter.value === 'cities-only' &&
          record.name.endsWith('市')) ||
        (municipalityFilter.value === 'population-top-1000' &&
          populationTop1000MunicipalityCodes.has(record.code))),
  ),
)
const currentQuestion = computed(
  () => questions.value[questionIndex.value] ?? null,
)

function startQuiz() {
  const scope = eligibleMunicipalities.value
  const selected = shuffled(scope).slice(0, Math.min(10, scope.length))
  questions.value = selected.map((record) => {
    const areaCode =
      record.areaCodes[Math.floor(Math.random() * record.areaCodes.length)]
    return {
      record,
      areaCode,
      choices:
        quizType.value === 'municipality-from-area-code'
          ? municipalityChoices(record, areaCode, scope, municipalities)
          : [],
    }
  })
  questionIndex.value = 0
  score.value = 0
  answer.value = ''
  answered.value = false
  phase.value = questions.value.length ? 'playing' : 'select'
}

function grade(isAnswerCorrect: boolean) {
  if (answered.value) return
  correct.value = isAnswerCorrect
  answered.value = true
  if (isAnswerCorrect) score.value += 1
}

function submitAreaCode() {
  const question = currentQuestion.value
  if (!question || !normalizeAreaCodeInput(answer.value)) return
  grade(isCorrectAreaCode(question.record, answer.value))
}

function selectMunicipality(record: MunicipalityRecord) {
  if (!currentQuestion.value) return
  answer.value = record.code
  grade(record.code === currentQuestion.value.record.code)
}

function nextQuestion() {
  if (questionIndex.value + 1 >= questions.value.length) {
    phase.value = 'finished'
    return
  }
  questionIndex.value += 1
  answer.value = ''
  answered.value = false
}

function resetQuiz() {
  phase.value = 'select'
  questions.value = []
}
</script>

<template>
  <section class="page-section area-code-quiz">
    <p class="eyebrow">知識クイズ</p>
    <template v-if="phase === 'select'">
      <h1>市外局番クイズ</h1>
      <p class="lead">
        自治体と市外局番の対応を、タイピングとは別枠で覚えます。
      </p>
      <fieldset class="selection-group">
        <legend>出題方向</legend>
        <div class="rule-card-grid">
          <label class="choice-card choice-card-compact">
            <input
              v-model="quizType"
              type="radio"
              value="area-code-from-municipality"
            />
            <Phone class="choice-icon" :size="22" />
            <span class="choice-copy">
              <strong>自治体 → 市外局番</strong>
              <small>市外局番を数字で入力</small>
            </span>
          </label>
          <label class="choice-card choice-card-compact">
            <input
              v-model="quizType"
              type="radio"
              value="municipality-from-area-code"
            />
            <ArrowLeftRight class="choice-icon" :size="22" />
            <span class="choice-copy">
              <strong>市外局番 → 自治体</strong>
              <small>該当する自治体を4択で回答</small>
            </span>
          </label>
        </div>
      </fieldset>
      <div class="area-code-filter-grid">
        <label class="select-control">
          <span>都道府県</span>
          <select v-model="prefectureCode">
            <option value="">全国</option>
            <option
              v-for="prefecture in prefectures"
              :key="prefecture.code"
              :value="prefecture.code"
            >
              {{ prefecture.name }}
            </option>
          </select>
        </label>
        <label class="select-control">
          <span>自治体の範囲</span>
          <select v-model="municipalityFilter">
            <option value="all">すべての市区町村</option>
            <option value="population-top-1000">人口トップ1000</option>
            <option value="cities-only">市のみ</option>
          </select>
        </label>
      </div>
      <button
        class="button button-primary start-button"
        type="button"
        @click="startQuiz"
      >
        <Play :size="19" fill="currentColor" /> 10問はじめる
      </button>
    </template>

    <template v-else-if="phase === 'playing' && currentQuestion">
      <header class="quiz-progress">
        <span>{{ questionIndex + 1 }} / {{ questions.length }}</span>
        <span>正解 {{ score }}</span>
      </header>
      <div class="area-code-question">
        <template v-if="quizType === 'area-code-from-municipality'">
          <p class="question-prompt">この自治体の市外局番は？</p>
          <h1>
            {{ currentQuestion.record.prefecture.name
            }}{{ currentQuestion.record.name }}
          </h1>
          <form class="area-code-answer-form" @submit.prevent="submitAreaCode">
            <label for="area-code-answer">市外局番</label>
            <input
              id="area-code-answer"
              v-model="answer"
              class="answer-input"
              inputmode="numeric"
              autocomplete="off"
              :disabled="answered"
              placeholder="例: 027"
            />
            <button
              v-if="!answered"
              class="button button-primary"
              type="submit"
            >
              回答する
            </button>
          </form>
        </template>
        <template v-else>
          <p class="question-prompt">この市外局番を使う自治体は？</p>
          <h1 class="area-code-number">{{ currentQuestion.areaCode }}</h1>
          <div class="area-code-choices">
            <button
              v-for="choice in currentQuestion.choices"
              :key="choice.code"
              class="button"
              type="button"
              :disabled="answered"
              @click="selectMunicipality(choice)"
            >
              {{ choice.prefecture.name }}{{ choice.name }}
            </button>
          </div>
        </template>

        <div v-if="answered" class="quiz-feedback" aria-live="polite">
          <strong :data-correct="correct">{{
            correct ? '正解' : '不正解'
          }}</strong>
          <p>
            {{ currentQuestion.record.prefecture.name
            }}{{ currentQuestion.record.name }}：
            <b>{{ currentQuestion.record.primaryAreaCode }}</b>
            <span v-if="currentQuestion.record.areaCodes.length > 1">
              （ほか
              {{
                currentQuestion.record.areaCodes
                  .filter(
                    (code) => code !== currentQuestion?.record.primaryAreaCode,
                  )
                  .join('、')
              }}）
            </span>
          </p>
          <button
            class="button button-primary"
            type="button"
            @click="nextQuestion"
          >
            {{ questionIndex + 1 === questions.length ? '結果を見る' : '次へ' }}
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <h1>{{ score }} / {{ questions.length }}問正解</h1>
      <div class="result-actions">
        <button class="button button-primary" type="button" @click="startQuiz">
          もう一度
        </button>
        <button class="button" type="button" @click="resetQuiz">
          条件を変える
        </button>
      </div>
    </template>
  </section>
</template>
