import {
  generatedMunicipalities,
  generatedPrefectures,
} from './generated-municipalities'

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
}

export const prefectures = generatedPrefectures

export const prefectureByCode = new Map(
  prefectures.map((item) => [item.code, item]),
)

export const municipalities: MunicipalityRecord[] = generatedMunicipalities.map(
  (item) => {
    const prefecture = prefectureByCode.get(item.prefectureCode)
    if (!prefecture)
      throw new Error(`Unknown prefecture code: ${item.prefectureCode}`)
    return { ...item, prefecture }
  },
)

export const municipalityByCode = new Map(
  municipalities.map((item) => [item.code, item]),
)

export const municipalityShapeUrl = (code: string) =>
  `/generated/geometry/${code}.svg`

export const prefectureShapeUrl = (code: string) =>
  `/generated/prefectures/${code}.svg`
