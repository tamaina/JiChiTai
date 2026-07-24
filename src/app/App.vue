<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <RouterLink class="site-title" to="/">JiChiTai</RouterLink>
      <nav aria-label="メインナビゲーション">
        <RouterLink to="/review">FSRS暗記</RouterLink>
        <RouterLink to="/explore">自治体一覧</RouterLink>
        <RouterLink to="/search">検索</RouterLink>
        <RouterLink to="/quiz">市外局番クイズ</RouterLink>
        <RouterLink to="/about">このゲームについて</RouterLink>
      </nav>
    </header>
    <main id="main-content">
      <RouterView />
    </main>
  </div>
</template>
