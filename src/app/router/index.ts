import { createRouter, createWebHistory } from 'vue-router'
import AboutPage from '../pages/AboutPage.vue'
import AreaCodeQuizPage from '../pages/AreaCodeQuizPage.vue'
import PlayPage from '../pages/PlayPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PlayPage },
    { path: '/play', component: PlayPage },
    { path: '/quiz', component: AreaCodeQuizPage },
    {
      path: '/review',
      component: () => import('../pages/ReviewPage.vue'),
    },
    {
      path: '/explore',
      component: () => import('../pages/ExplorePage.vue'),
    },
    {
      path: '/search',
      component: () => import('../pages/SearchPage.vue'),
    },
    { path: '/about', component: AboutPage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
