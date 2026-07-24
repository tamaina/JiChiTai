import { toHiragana } from 'wanakana'
import { municipalities, type MunicipalityRecord } from './municipalities'

export interface MunicipalitySearchResult {
  municipality: MunicipalityRecord
  matchedAreaCodes: string[]
  matchedPostalCodePrefixes: string[]
}

function normalizeText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '')
}

function numericQuery(value: string) {
  const normalized = value
    .normalize('NFKC')
    .replace(/〒/g, '')
    .replace(/[\s‐‑‒–—―ー－-]/g, '')
  return /^\d+$/.test(normalized) ? normalized : null
}

export function searchMunicipalities(
  query: string,
  records: MunicipalityRecord[] = municipalities,
): MunicipalitySearchResult[] {
  const text = normalizeText(query)
  if (!text) return []

  const digits = numericQuery(query)
  const kanaQuery = digits ? '' : toHiragana(text, { IMEMode: true })
  const postalPrefix =
    digits && (digits.length === 3 || digits.length === 7)
      ? digits.slice(0, 3)
      : null

  return records.flatMap((municipality) => {
    const matchedAreaCodes = digits
      ? municipality.areaCodes.filter(
          (areaCode) =>
            areaCode === digits ||
            (digits.length > 5 && digits.startsWith(areaCode)),
        )
      : []
    const matchedPostalCodePrefixes = postalPrefix
      ? municipality.postalCodePrefixes.filter(
          (prefix) => prefix === postalPrefix,
        )
      : []
    const nameMatches =
      !digits &&
      (normalizeText(municipality.name).includes(text) ||
        toHiragana(normalizeText(municipality.kana)).includes(kanaQuery))

    return nameMatches ||
      matchedAreaCodes.length ||
      matchedPostalCodePrefixes.length
      ? [{ municipality, matchedAreaCodes, matchedPostalCodePrefixes }]
      : []
  })
}
