import {
  generatedMunicipalities,
  generatedPrefectures,
} from './generated-municipalities'
import { generatedAreaCodes } from './generated-area-codes'
import {
  generatedEmblems,
  type GeneratedEmblemRecord,
} from './generated-emblems'
import { generatedPostalPrefixes } from './generated-postal-prefixes'

export interface PrefectureRecord {
  code: string
  name: string
  kana: string
}

export interface GeneratedMunicipalityRecord {
  code: string
  prefectureCode: string
  name: string
  kana: string
  districtName: string
  placementTransform: string
}

export interface MunicipalityRecord extends GeneratedMunicipalityRecord {
  prefecture: PrefectureRecord
  primaryAreaCode: string | null
  areaCodes: string[]
  representativePhone: string | null
  emblem: GeneratedEmblemRecord | null
  postalCodePrefixes: string[]
}

export const prefectures = generatedPrefectures

export const prefectureByCode = new Map(
  prefectures.map((item) => [item.code, item]),
)

const areaCodeByMunicipalityCode = new Map(
  generatedAreaCodes.map((item) => [item.code, item]),
)
const emblemByMunicipalityCode = new Map(
  generatedEmblems.map((item) => [item.code, item]),
)
const postalPrefixesByMunicipalityCode = new Map(
  generatedPostalPrefixes.map((item) => [item.code, item.prefixes]),
)

export const municipalities: MunicipalityRecord[] = generatedMunicipalities.map(
  (item) => {
    const prefecture = prefectureByCode.get(item.prefectureCode)
    if (!prefecture)
      throw new Error(`Unknown prefecture code: ${item.prefectureCode}`)
    const areaCode = areaCodeByMunicipalityCode.get(item.code)
    return {
      ...item,
      prefecture,
      primaryAreaCode: areaCode?.primaryAreaCode ?? null,
      areaCodes: areaCode?.areaCodes ?? [],
      representativePhone: areaCode?.representativePhone ?? null,
      emblem: emblemByMunicipalityCode.get(item.code) ?? null,
      postalCodePrefixes: postalPrefixesByMunicipalityCode.get(item.code) ?? [],
    }
  },
)

export const municipalityByCode = new Map(
  municipalities.map((item) => [item.code, item]),
)

export const municipalityShapeUrl = (code: string) =>
  `/generated/geometry/${code}.svg`

export const prefectureShapeUrl = (code: string) =>
  `/generated/prefectures/${code}.svg`
