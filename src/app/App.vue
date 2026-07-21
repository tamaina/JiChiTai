<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <RouterLink class="site-title" to="/">JiChiTai</RouterLink>
      <nav aria-label="メインナビゲーション">
        <RouterLink to="/about">このゲームについて</RouterLink>
      </nav>
    </header>
    <main id="main-content">
      <RouterView />
    </main>
  </div>
</template>
