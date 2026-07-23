import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../src/app/App.vue'
import PlayPage from '../src/app/pages/PlayPage.vue'

const EmptyPage = { template: '<div />' }

function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: PlayPage },
      { path: '/play', component: PlayPage },
      { path: '/quiz', component: EmptyPage },
      { path: '/about', component: EmptyPage },
    ],
  })
  return { router, wrapper: mount(App, { global: { plugins: [router] } }) }
}

describe('App', () => {
  it('renders the mode selection at the root route', async () => {
    const { router, wrapper } = mountApp()
    await router.isReady()
    expect(wrapper.text()).toContain('JiChiTai')
    expect(wrapper.text()).toContain('モードを選ぶ')
    expect(wrapper.get('button').text()).toContain('開始する')
  })
})
