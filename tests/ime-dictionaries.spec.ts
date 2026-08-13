import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  nationwideDictionaryUrl,
  prefectureDictionaryUrl,
  preferredImeDictionaryFormat,
} from '../src/shared/data/ime-dictionaries'

const dictionaryRoot = path.resolve('public/generated/dictionaries')

describe('IME dictionary downloads', () => {
  it('selects a default format from the operating system', () => {
    expect(preferredImeDictionaryFormat('Mozilla/5.0 (Macintosh)')).toBe(
      'macos',
    )
    expect(preferredImeDictionaryFormat('Mozilla/5.0 (Windows NT 10.0)')).toBe(
      'windows',
    )
    expect(
      preferredImeDictionaryFormat('Mozilla/5.0 (X11; Linux x86_64)'),
    ).toBe('google')
    expect(preferredImeDictionaryFormat('', 'iPad')).toBe('macos')
  })

  it('builds stable public download URLs', () => {
    expect(prefectureDictionaryUrl('macos', '10')).toBe(
      '/generated/dictionaries/macos/10-gunma.plist',
    )
    expect(nationwideDictionaryUrl('windows')).toBe(
      '/generated/dictionaries/jichitai-windows.zip',
    )
  })

  it('generates 47 dictionaries for every format', async () => {
    for (const format of ['macos', 'windows', 'google']) {
      expect(await readdir(path.join(dictionaryRoot, format))).toHaveLength(47)
    }
  })

  it('contains the expected suffix variants and descriptions', async () => {
    const mac = await readFile(
      path.join(dictionaryRoot, 'macos/10-gunma.plist'),
      'utf8',
    )
    expect(mac).toContain('<string>ぐんま</string>')
    expect(mac).toContain('<string>群馬</string>')
    expect(mac).toContain('<string>ふじおかし</string>')
    expect(mac).toContain('<string>藤岡市</string>')
    expect(mac).toContain('<string>ふじおか</string>')
    expect(mac).toContain('<string>藤岡</string>')

    const hokkaido = await readFile(
      path.join(dictionaryRoot, 'google/01-hokkaido.txt'),
      'utf8',
    )
    expect(hokkaido).toContain('ほっかいどう\t北海道\t地名\t北海道')
    expect(hokkaido).not.toContain('ほっかい\t北海')

    const gunma = await readFile(
      path.join(dictionaryRoot, 'google/10-gunma.txt'),
      'utf8',
    )
    expect(gunma).toContain('うえのむら\t上野村\t地名\t群馬県／多野郡')
  })

  it('packages 47 prefectures and a README in each nationwide ZIP', async () => {
    for (const format of ['macos', 'windows', 'google']) {
      const archive = unzipSync(
        await readFile(path.join(dictionaryRoot, `jichitai-${format}.zip`)),
      )
      expect(Object.keys(archive)).toHaveLength(48)
      expect(Object.keys(archive)).toContain('README.txt')
      expect(strFromU8(archive['README.txt'])).toContain('47')
    }
  })
})
