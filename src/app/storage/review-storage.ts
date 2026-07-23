import { State } from 'ts-fsrs'
import { isReviewMode, type StoredReviewCard } from '../../shared/review/fsrs'

const DATABASE_NAME = 'jichitai-fsrs'
const DATABASE_VERSION = 1
const STORE_NAME = 'cards'
export const REVIEW_EXPORT_VERSION = 1

export interface ReviewExport {
  format: 'jichitai-fsrs-history'
  version: typeof REVIEW_EXPORT_VERSION
  exportedAt: string
  cards: StoredReviewCard[]
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function getAllReviewCards() {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const done = transactionDone(transaction)
    const request = transaction.objectStore(STORE_NAME).getAll()
    const cards = await new Promise<StoredReviewCard[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await done
    return cards
  } finally {
    database.close()
  }
}

export async function putReviewCard(card: StoredReviewCard) {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore(STORE_NAME).put(card)
    await done
  } finally {
    database.close()
  }
}

export async function replaceReviewCards(cards: StoredReviewCard[]) {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const done = transactionDone(transaction)
    const store = transaction.objectStore(STORE_NAME)
    store.clear()
    for (const card of cards) store.put(card)
    await done
  } finally {
    database.close()
  }
}

export function createReviewExport(
  cards: StoredReviewCard[],
  now = new Date(),
): ReviewExport {
  return {
    format: 'jichitai-fsrs-history',
    version: REVIEW_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    cards,
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSerializedCard(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const card = value as Record<string, unknown>
  return (
    typeof card.due === 'string' &&
    !Number.isNaN(Date.parse(card.due)) &&
    isFiniteNumber(card.stability) &&
    isFiniteNumber(card.difficulty) &&
    isFiniteNumber(card.elapsed_days) &&
    isFiniteNumber(card.scheduled_days) &&
    isFiniteNumber(card.learning_steps) &&
    isFiniteNumber(card.reps) &&
    isFiniteNumber(card.lapses) &&
    Number.isInteger(card.state) &&
    (card.state as number) >= State.New &&
    (card.state as number) <= State.Relearning &&
    (card.last_review === undefined ||
      (typeof card.last_review === 'string' &&
        !Number.isNaN(Date.parse(card.last_review))))
  )
}

function isHistoryEntry(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    Number.isInteger(entry.rating) &&
    (entry.rating as number) >= 1 &&
    (entry.rating as number) <= 4 &&
    typeof entry.reviewedAt === 'string' &&
    !Number.isNaN(Date.parse(entry.reviewedAt)) &&
    isFiniteNumber(entry.scheduledDays) &&
    Number.isInteger(entry.state) &&
    (entry.state as number) >= State.New &&
    (entry.state as number) <= State.Relearning
  )
}

function isStoredReviewCard(value: unknown): value is StoredReviewCard {
  if (!value || typeof value !== 'object') return false
  const card = value as Record<string, unknown>
  if (
    typeof card.id !== 'string' ||
    !isReviewMode(card.mode) ||
    typeof card.municipalityCode !== 'string' ||
    !isSerializedCard(card.card) ||
    !Array.isArray(card.history) ||
    !card.history.every(isHistoryEntry) ||
    typeof card.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(card.updatedAt))
  )
    return false
  return card.id === `${card.mode}:${card.municipalityCode}`
}

export function parseReviewExport(value: unknown): ReviewExport {
  if (!value || typeof value !== 'object')
    throw new Error('JSONの形式が正しくありません。')
  const data = value as Record<string, unknown>
  if (
    data.format !== 'jichitai-fsrs-history' ||
    data.version !== REVIEW_EXPORT_VERSION ||
    typeof data.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(data.exportedAt)) ||
    !Array.isArray(data.cards) ||
    !data.cards.every(isStoredReviewCard) ||
    new Set(
      (data.cards as Array<Record<string, unknown>>).map((card) => card.id),
    ).size !== data.cards.length
  )
    throw new Error('対応していない学習履歴です。')
  return data as unknown as ReviewExport
}
