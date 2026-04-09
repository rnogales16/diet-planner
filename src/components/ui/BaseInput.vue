<script setup>
defineProps({
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: '' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ label }}</label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      class="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 focus:bg-white transition-all placeholder:text-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-600 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/50"
      @input="$emit('update:modelValue', type === 'number' ? Number($event.target.value) : $event.target.value)"
    />
  </div>
</template>
