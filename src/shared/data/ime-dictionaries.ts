import prefectureRomaji from './prefecture-romaji.json'

export type ImeDictionaryFormat = 'macos' | 'windows' | 'google'

export const imeDictionaryFormats: Array<{
  value: ImeDictionaryFormat
  label: string
  extension: string
}> = [
  { value: 'macos', label: 'macOS', extension: 'plist' },
  { value: 'windows', label: 'Microsoft IME', extension: 'txt' },
  { value: 'google', label: 'Google日本語入力 / Mozc', extension: 'txt' },
]

export function preferredImeDictionaryFormat(
  userAgent: string,
  platform = '',
): ImeDictionaryFormat {
  const environment = `${userAgent} ${platform}`
  if (/Windows/i.test(environment)) return 'windows'
  if (/Macintosh|Mac OS|iPhone|iPad|iPod/i.test(environment)) return 'macos'
  return 'google'
}

export function prefectureDictionaryUrl(
  format: ImeDictionaryFormat,
  code: string,
) {
  const extension =
    imeDictionaryFormats.find((item) => item.value === format)?.extension ??
    'txt'
  const romaji = prefectureRomaji[code as keyof typeof prefectureRomaji]
  if (!romaji) throw new Error(`Unknown prefecture code: ${code}`)
  return `/generated/dictionaries/${format}/${code}-${romaji}.${extension}`
}

export function nationwideDictionaryUrl(format: ImeDictionaryFormat) {
  const extension =
    imeDictionaryFormats.find((item) => item.value === format)?.extension ??
    'txt'
  return `/generated/dictionaries/${format}/jichitai-all.${extension}`
}
