import type { MunicipalityRecord } from '../data/municipalities'

export type AreaCodeQuizType =
  'area-code-from-municipality' | 'municipality-from-area-code'

export function normalizeAreaCodeInput(value: string): string {
  return value.normalize('NFKC').replace(/\D/g, '')
}

export function isCorrectAreaCode(
  record: MunicipalityRecord,
  value: string,
): boolean {
  return record.areaCodes.includes(normalizeAreaCodeInput(value))
}

export function shuffled<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function municipalityChoices(
  target: MunicipalityRecord,
  areaCode: string,
  scope: readonly MunicipalityRecord[],
  fallback: readonly MunicipalityRecord[],
  random: () => number = Math.random,
): MunicipalityRecord[] {
  const eligible = (records: readonly MunicipalityRecord[]) =>
    records.filter(
      (record) =>
        record.code !== target.code && !record.areaCodes.includes(areaCode),
    )
  const candidates = eligible(scope)
  if (candidates.length < 3) {
    for (const record of eligible(fallback)) {
      if (!candidates.some((candidate) => candidate.code === record.code))
        candidates.push(record)
    }
  }
  return shuffled([target, ...shuffled(candidates, random).slice(0, 3)], random)
}
