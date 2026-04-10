<script setup>
defineProps({
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' },
  suffix: { type: String, default: '' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <label class="field">
    <span v-if="label" class="field__label">{{ label }}</span>
    <span class="field__control">
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        class="app-input"
        :class="{ 'app-input--with-suffix': suffix }"
        @input="$emit('update:modelValue', type === 'number' ? Number($event.target.value) : $event.target.value)"
      />
      <span v-if="suffix" class="field__suffix">{{ suffix }}</span>
    </span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.field__control {
  position: relative;
  display: block;
}

.field__suffix {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--text-faint);
  pointer-events: none;
}

.app-input--with-suffix {
  padding-right: 36px;
}
</style>
