<script setup>
defineProps({
  size: { type: Number, default: 28 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    class="app-logo"
    aria-hidden="true"
  >
    <path d="M16 2C24 7 28 15 24 23C21 29 11 29 8 23C4 15 8 7 16 2Z" fill="currentColor"/>
    <path d="M16 8L16 24" stroke="var(--surface)" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M11.5 14.5L16 18.5" stroke="var(--surface)" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M20.5 12.5L16 16.5" stroke="var(--surface)" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M12.5 19.5L16 22" stroke="var(--surface)" stroke-width="1" stroke-linecap="round" opacity="0.5"/>
    <path d="M19 18L16 20.5" stroke="var(--surface)" stroke-width="1" stroke-linecap="round" opacity="0.5"/>
  </svg>
</template>

<style scoped>
.app-logo {
  color: var(--accent);
  flex-shrink: 0;
}
</style>
