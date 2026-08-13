import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import ExplorePage from '../src/app/pages/ExplorePage.vue'

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/explore', component: ExplorePage }],
  })
  await router.push('/explore')
  await router.isReady()
  return mount(ExplorePage, { global: { plugins: [router] } })
}

describe('IME dictionary download UI', () => {
  beforeEach(() => localStorage.clear())

  it('updates all downloads when the format changes and remembers it', async () => {
    localStorage.setItem('jichitai.ime-dictionary-format', 'macos')
    const wrapper = await mountPage()

    expect(
      wrapper.get<HTMLAnchorElement>('a[download]').attributes('href'),
    ).toBe('/generated/dictionaries/macos/jichitai-all.plist')
    expect(wrapper.findAll('.prefecture-download')).toHaveLength(47)
    expect(
      wrapper.get<HTMLAnchorElement>('.prefecture-download').attributes('href'),
    ).toBe('/generated/dictionaries/macos/01-hokkaido.plist')

    await wrapper.get('select').setValue('windows')
    expect(
      wrapper.get<HTMLAnchorElement>('a[download]').attributes('href'),
    ).toBe('/generated/dictionaries/windows/jichitai-all.txt')
    expect(
      wrapper.get<HTMLAnchorElement>('.prefecture-download').attributes('href'),
    ).toBe('/generated/dictionaries/windows/01-hokkaido.txt')
    expect(localStorage.getItem('jichitai.ime-dictionary-format')).toBe(
      'windows',
    )
  })
})
