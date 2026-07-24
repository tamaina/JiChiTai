import { toHiragana } from 'wanakana'
import { municipalities, type MunicipalityRecord } from './municipalities'

export type MunicipalitySearchMode = 'all' | 'code' | 'postal' | 'phone'

export interface MunicipalitySearchResult {
  municipality: MunicipalityRecord
  matchedAreaCodes: string[]
  matchedPhoneNumbers: string[]
  matchedPostalCodePrefixes: string[]
}

function normalizeText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '')
}

function numericQuery(value: string) {
  const normalized = value.normalize('NFKC').trim()
  if (!/^[\d〒+()\s‐‑‒–—―ー－-]+$/.test(normalized)) return null

  const digits = normalized.replace(/\D/g, '')
  if (!digits) return null
  return normalized.startsWith('+81') ? `0${digits.slice(2)}` : digits
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, '')
}

function longestPrefixes(query: string, values: string[]) {
  const matches = [...new Set(values)].filter((value) =>
    query.startsWith(value),
  )
  const longestLength = Math.max(0, ...matches.map((value) => value.length))
  return new Set(matches.filter((value) => value.length === longestLength))
}

export function searchMunicipalities(
  query: string,
  mode: MunicipalitySearchMode = 'all',
  records: MunicipalityRecord[] = municipalities,
): MunicipalitySearchResult[] {
  const text = normalizeText(query)
  if (!text) return []

  const digits = numericQuery(query)
  const kanaQuery = digits ? '' : toHiragana(text, { IMEMode: true })
  const searchNames = mode === 'all'
  const searchMunicipalityCodes = mode === 'all' || mode === 'code'
  const searchPostalCodes =
    mode === 'postal' ||
    (mode === 'all' && (digits?.length === 3 || digits?.length === 7))
  const searchPhoneNumbers = mode === 'all' || mode === 'phone'
  const matchedPostalPrefixes =
    digits && searchPostalCodes
      ? longestPrefixes(
          digits,
          records.flatMap((record) => record.postalCodePrefixes),
        )
      : new Set<string>()
  const matchedPhonePrefixes =
    digits && searchPhoneNumbers
      ? longestPrefixes(
          digits,
          records.flatMap((record) => [
            ...record.areaCodes,
            ...(record.representativePhone
              ? [normalizePhoneNumber(record.representativePhone)]
              : []),
          ]),
        )
      : new Set<string>()

  return records.flatMap((municipality) => {
    const matchedAreaCodes = municipality.areaCodes.filter((areaCode) =>
      matchedPhonePrefixes.has(areaCode),
    )
    const matchedPhoneNumbers = municipality.representativePhone
      ? [municipality.representativePhone].filter((phoneNumber) =>
          matchedPhonePrefixes.has(normalizePhoneNumber(phoneNumber)),
        )
      : []
    const matchedPostalCodePrefixes = municipality.postalCodePrefixes.filter(
      (prefix) => matchedPostalPrefixes.has(prefix),
    )
    const nameMatches =
      searchNames &&
      !digits &&
      (normalizeText(municipality.name).includes(text) ||
        toHiragana(normalizeText(municipality.kana)).includes(kanaQuery))
    const municipalityCodeMatches =
      searchMunicipalityCodes && digits === municipality.code

    return nameMatches ||
      municipalityCodeMatches ||
      matchedAreaCodes.length ||
      matchedPhoneNumbers.length ||
      matchedPostalCodePrefixes.length
      ? [
          {
            municipality,
            matchedAreaCodes,
            matchedPhoneNumbers,
            matchedPostalCodePrefixes,
          },
        ]
      : []
  })
}
