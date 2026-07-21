import { createRouter, createWebHistory } from 'vue-router'
import AboutPage from '../pages/AboutPage.vue'
import PlayPage from '../pages/PlayPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PlayPage },
    { path: '/play', component: PlayPage },
    { path: '/about', component: AboutPage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
