<script setup>
import DayColumn from './DayColumn.vue'

defineProps({
  week: { type: Object, required: true },
})

defineEmits(['addDish', 'editDish', 'deleteDish', 'viewDish'])
</script>

<template>
  <div v-if="week" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
    <DayColumn
      v-for="(day, idx) in week.days"
      :key="day.date"
      :day="day"
      :dayIndex="idx"
      @addDish="$emit('addDish', $event)"
      @editDish="$emit('editDish', $event)"
      @deleteDish="$emit('deleteDish', $event)"
      @viewDish="$emit('viewDish', $event)"
    />
  </div>
</template>
