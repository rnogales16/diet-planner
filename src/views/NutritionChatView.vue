<script setup>
import { ref, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageCircle, Send, Loader, Check, Copy, Plus, X } from 'lucide-vue-next'
import { useDietStore } from '@/stores/dietStore'

const { t, locale } = useI18n()
const store = useDietStore()

const messages = ref([])
const input = ref('')
const sending = ref(false)
const error = ref('')
const chatArea = ref(null)
const appliedMacros = ref(false)
const appliedTo = ref('') // name of the person macros were applied to
const copied = ref(false)
const showPersonPicker = ref(false)
const newPersonName = ref('')
const showNewPersonInput = ref(false)

// Track the latest suggested macros from the AI
const latestMacros = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].suggestedMacros) return messages.value[i].suggestedMacros
  }
  return null
})

// Build history for the API (alternating user/model turns)
function buildHistory() {
  return messages.value.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    text: m.role === 'user' ? m.text : JSON.stringify({ reply: m.text, suggestedMacros: m.suggestedMacros || null }),
  }))
}

async function scrollToBottom() {
  await nextTick()
  if (chatArea.value) {
    chatArea.value.scrollTop = chatArea.value.scrollHeight
  }
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || sending.value) return

  error.value = ''
  appliedMacros.value = false
  messages.value.push({ role: 'user', text })
  input.value = ''
  await scrollToBottom()

  sending.value = true
  try {
    const res = await fetch('/api/nutrition-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: buildHistory().slice(0, -1), // exclude the message we just added
        profile: store.profile,
        language: locale.value,
      }),
    })

    const data = await res.json()
    if (!data.success) {
      error.value = data.error || t('nutritionChat.error')
      return
    }

    messages.value.push({
      role: 'assistant',
      text: data.reply,
      suggestedMacros: data.suggestedMacros || null,
    })
    await scrollToBottom()
  } catch (err) {
    error.value = err.message || t('nutritionChat.error')
  } finally {
    sending.value = false
  }
}

const hasPeople = computed(() => {
  const people = store.profile.people
  return Array.isArray(people) && people.some((p) => p.name)
})

function handleApplyClick() {
  if (!latestMacros.value) return
  if (hasPeople.value) {
    showPersonPicker.value = true
    showNewPersonInput.value = false
    newPersonName.value = ''
  } else {
    applyToPrimary()
  }
}

function applyToPrimary() {
  const m = latestMacros.value
  store.updateProfile({
    ...store.profile,
    calorieTarget: m.calories,
    proteinTarget: m.protein,
    carbsTarget: m.carbs,
    fatTarget: m.fat,
    vegetableTarget: m.vegetables,
  })
  appliedMacros.value = true
  appliedTo.value = t('nutritionChat.you')
  showPersonPicker.value = false
}

function applyToPerson(idx) {
  const m = latestMacros.value
  const people = [...(store.profile.people || [])]
  people[idx] = {
    ...people[idx],
    calorieTarget: m.calories,
    proteinTarget: m.protein,
    carbsTarget: m.carbs,
    fatTarget: m.fat,
    vegetableTarget: m.vegetables,
  }
  store.updateProfile({ ...store.profile, people })
  appliedMacros.value = true
  appliedTo.value = people[idx].name
  showPersonPicker.value = false
}

function createAndApply() {
  const name = newPersonName.value.trim()
  if (!name) return
  const m = latestMacros.value
  const people = [...(store.profile.people || [])]
  const ALL_MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
  people.push({
    name,
    calorieTarget: m.calories,
    proteinTarget: m.protein,
    carbsTarget: m.carbs,
    fatTarget: m.fat,
    vegetableTarget: m.vegetables,
    enabledMeals: [...ALL_MEAL_TYPES],
  })
  store.updateProfile({
    ...store.profile,
    people,
    servings: 1 + people.filter((p) => p.name || p.calorieTarget).length,
  })
  appliedMacros.value = true
  appliedTo.value = name
  showPersonPicker.value = false
}

function copyTemplate() {
  navigator.clipboard.writeText(exampleTemplate.value).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  })
}

const exampleTemplate = computed(() => {
  if (messages.value.length > 0) return ''
  return locale.value === 'es'
    ? `Soy [hombre/mujer], tengo [X] años, peso [X] kg y mido [X] cm. Mi objetivo es [perder grasa / ganar masa muscular / mantenerme / mejorar mi salud]. Entreno [X] días a la semana haciendo [tipo de ejercicio: pesas, cardio, crossfit, etc.]. Mi trabajo es [sedentario / activo / de pie todo el día]. ¿Puedes calcularme las calorías y macros que necesito?`
    : `I'm [male/female], [X] years old, I weigh [X] kg and I'm [X] cm tall. My goal is to [lose fat / build muscle / maintain / improve health]. I train [X] days a week doing [type of exercise: weights, cardio, crossfit, etc.]. My job is [sedentary / active / on my feet all day]. Can you calculate the calories and macros I need?`
})
</script>

<template>
  <div class="nchat">
    <header class="nchat__head">
      <div class="nchat__icon">
        <MessageCircle :size="20" />
      </div>
      <div>
        <h1 class="nchat__title font-display">{{ t('nutritionChat.title') }}</h1>
        <p class="nchat__sub">{{ t('nutritionChat.subtitle') }}</p>
      </div>
    </header>

    <div class="nchat__body app-card">
      <div ref="chatArea" class="nchat__messages">
        <!-- Empty state -->
        <div v-if="messages.length === 0 && !sending" class="nchat__empty">
          <MessageCircle :size="32" />
          <p>{{ t('nutritionChat.emptyTitle') }}</p>
          <p class="nchat__empty-sub">{{ t('nutritionChat.emptySubtitle') }}</p>
          <div v-if="exampleTemplate" class="nchat__template">
            <p class="nchat__template-label">{{ t('nutritionChat.templateLabel') }}</p>
            <div class="nchat__template-box">
              <p class="nchat__template-text">{{ exampleTemplate }}</p>
              <button type="button" class="nchat__template-copy" @click="copyTemplate" :title="t('nutritionChat.copyTemplate')">
                <Check v-if="copied" :size="14" />
                <Copy v-else :size="14" />
              </button>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="nchat__msg"
          :class="msg.role === 'user' ? 'nchat__msg--user' : 'nchat__msg--ai'"
        >
          <div class="nchat__bubble" v-html="formatReply(msg.text)" />
          <!-- Macro card -->
          <div v-if="msg.suggestedMacros" class="nchat__macros-card">
            <div class="nchat__macros-grid">
              <div class="nchat__macro">
                <span class="nchat__macro-value">{{ msg.suggestedMacros.calories }}</span>
                <span class="nchat__macro-label">kcal</span>
              </div>
              <div class="nchat__macro">
                <span class="nchat__macro-value">{{ msg.suggestedMacros.protein }}g</span>
                <span class="nchat__macro-label">{{ t('nutritionChat.protein') }}</span>
              </div>
              <div class="nchat__macro">
                <span class="nchat__macro-value">{{ msg.suggestedMacros.carbs }}g</span>
                <span class="nchat__macro-label">{{ t('nutritionChat.carbs') }}</span>
              </div>
              <div class="nchat__macro">
                <span class="nchat__macro-value">{{ msg.suggestedMacros.fat }}g</span>
                <span class="nchat__macro-label">{{ t('nutritionChat.fat') }}</span>
              </div>
              <div class="nchat__macro">
                <span class="nchat__macro-value">{{ msg.suggestedMacros.vegetables }}g</span>
                <span class="nchat__macro-label">{{ t('nutritionChat.vegetables') }}</span>
              </div>
            </div>
            <template v-if="idx === messages.length - 1 || msg.suggestedMacros === latestMacros">
              <button
                v-if="!appliedMacros"
                type="button"
                class="app-btn app-btn--primary nchat__apply-btn"
                @click="handleApplyClick"
              >
                {{ t('nutritionChat.applyToProfile') }}
              </button>
              <p v-else class="nchat__applied-msg">
                <Check :size="14" /> {{ t('nutritionChat.appliedTo', { name: appliedTo }) }}
              </p>
            </template>
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="sending" class="nchat__msg nchat__msg--ai">
          <div class="nchat__bubble nchat__typing">
            <span /><span /><span />
          </div>
        </div>
      </div>

      <!-- Error -->
      <p v-if="error" class="nchat__error">{{ error }}</p>

      <!-- Input -->
      <form class="nchat__input-row" @submit.prevent="sendMessage">
        <input
          v-model="input"
          class="app-input nchat__input"
          :placeholder="t('nutritionChat.placeholder')"
          :disabled="sending"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <button type="submit" class="app-btn app-btn--primary nchat__send" :disabled="!input.trim() || sending">
          <Loader v-if="sending" :size="16" class="spin" />
          <Send v-else :size="16" />
        </button>
      </form>
    </div>

    <!-- Person picker overlay -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPersonPicker" class="picker-backdrop" @click.self="showPersonPicker = false">
          <div class="picker">
            <div class="picker__head">
              <h3 class="picker__title">{{ t('nutritionChat.pickPerson') }}</h3>
              <button type="button" class="picker__close" @click="showPersonPicker = false">
                <X :size="16" />
              </button>
            </div>
            <div class="picker__list">
              <button type="button" class="picker__option" @click="applyToPrimary">
                {{ t('nutritionChat.you') }}
              </button>
              <button
                v-for="(person, idx) in store.profile.people"
                :key="idx"
                type="button"
                class="picker__option"
                @click="applyToPerson(idx)"
              >
                {{ person.name || t('nutritionChat.unnamed') }}
              </button>
            </div>
            <div class="picker__new">
              <template v-if="!showNewPersonInput">
                <button type="button" class="picker__option picker__option--new" @click="showNewPersonInput = true">
                  <Plus :size="14" /> {{ t('nutritionChat.newPerson') }}
                </button>
              </template>
              <template v-else>
                <div class="picker__new-row">
                  <input
                    v-model="newPersonName"
                    class="app-input picker__new-input"
                    :placeholder="t('nutritionChat.newPersonPlaceholder')"
                    @keydown.enter.prevent="createAndApply"
                    ref="newPersonInputRef"
                  />
                  <button type="button" class="app-btn app-btn--primary app-btn--sm" :disabled="!newPersonName.trim()" @click="createAndApply">
                    {{ t('nutritionChat.create') }}
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
export default {
  methods: {
    formatReply(text) {
      if (!text) return ''
      // Convert **bold** to <strong>
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
      return html
    },
  },
}
</script>

<style scoped>
.nchat {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
  height: calc(100vh - 120px);
}

.nchat__head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.nchat__icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background-color: var(--accent-tint);
  color: var(--accent);
}

.nchat__title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.nchat__sub {
  font-size: 13px;
  color: var(--text-faint);
}

.nchat__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  min-height: 0;
}

.nchat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.nchat__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-faint);
  text-align: center;
  margin: auto 0;
}

.nchat__empty p:first-of-type {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-muted);
}

.nchat__empty-sub {
  font-size: 13px;
  max-width: 400px;
}

.nchat__template {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  width: 100%;
  max-width: 500px;
}

.nchat__template-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.nchat__template-box {
  position: relative;
  padding: 14px 44px 14px 14px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.nchat__template-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
}

.nchat__template-copy {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background-color: var(--surface);
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nchat__template-copy:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.nchat__msg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 85%;
}

.nchat__msg--user {
  align-self: flex-end;
  align-items: flex-end;
}

.nchat__msg--ai {
  align-self: flex-start;
  align-items: flex-start;
}

.nchat__bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.nchat__msg--user .nchat__bubble {
  background-color: var(--accent);
  color: white;
  border-bottom-right-radius: 4px;
}

.nchat__msg--ai .nchat__bubble {
  background-color: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}

.nchat__typing {
  display: flex;
  gap: 4px;
  padding: 14px 18px;
}

.nchat__typing span {
  width: 8px;
  height: 8px;
  background-color: var(--text-faint);
  border-radius: 999px;
  animation: typing 1.4s infinite ease-in-out;
}

.nchat__typing span:nth-child(2) { animation-delay: 0.2s; }
.nchat__typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

.nchat__macros-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background-color: var(--accent-tint);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  max-width: 360px;
}

.nchat__macros-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  text-align: center;
}

.nchat__macro-value {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.nchat__macro-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-faint);
  text-transform: uppercase;
}

.nchat__apply-btn {
  align-self: stretch;
}

.nchat__error {
  padding: 8px 20px;
  font-size: 12px;
  color: var(--danger);
  flex-shrink: 0;
}

.nchat__input-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.nchat__input {
  flex: 1;
  min-height: 42px;
}

.nchat__send {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.nchat__applied-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background-color: rgb(0 0 0 / 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.picker {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg, 0 8px 30px rgb(0 0 0 / 0.12));
  width: 100%;
  max-width: 360px;
  overflow: hidden;
}

.picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border);
}

.picker__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.picker__close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: 6px;
  cursor: pointer;
}

.picker__close:hover {
  background-color: var(--surface-2);
  color: var(--text);
}

.picker__list {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
}

.picker__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
}

.picker__option:hover {
  background-color: var(--surface-2);
}

.picker__option--new {
  color: var(--accent);
  font-weight: 600;
}

.picker__new {
  padding: 8px;
  border-top: 1px solid var(--border);
}

.picker__new-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.picker__new-input {
  flex: 1;
  min-height: 36px;
  font-size: 13px;
}

@media (max-width: 768px) {
  .picker-backdrop {
    align-items: flex-end;
    padding: 0;
  }
  .picker {
    max-width: 100%;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }
}

@media (max-width: 768px) {
  .nchat {
    height: calc(100vh - 170px);
    height: calc(100dvh - 170px);
  }

  .nchat__title {
    font-size: 20px;
  }

  .nchat__msg {
    max-width: 90%;
  }

  .nchat__macros-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .nchat__messages {
    padding: 12px;
  }

  .nchat__input-row {
    padding: 10px 12px;
  }
}
</style>
