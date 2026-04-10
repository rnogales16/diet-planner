<script setup>
import DayColumn from './DayColumn.vue'

defineProps({
  week: { type: Object, required: true },
})

defineEmits(['addDish', 'editDish', 'deleteDish', 'viewDish'])
</script>

<template>
  <div v-if="week" class="weekly-grid">
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

<style scoped>
.weekly-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1100px) {
  .weekly-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .weekly-grid {
    grid-template-columns: 1fr;
  }
}
</style>
