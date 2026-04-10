<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger
  size: { type: String, default: 'md' }, // sm | md | lg
})
</script>

<template>
  <button
    class="app-btn"
    :class="[
      `app-btn--${variant}`,
      size !== 'md' && `app-btn--${size}`,
    ]"
  >
    <slot />
  </button>
</template>
