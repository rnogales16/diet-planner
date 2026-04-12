<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock, Flame, Users, Pencil, Trash2, Send, Sparkles, Loader2, MessageCircle, Check, Ban } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'
import { localizedDish } from '@/utils/dishLocale'
import { useDietStore } from '@/stores/dietStore'
import { chatAboutDish } from '@/services/dishChat'

const { t, locale } = useI18n()
const store = useDietStore()

const props = defineProps({
  show: { type: Boolean, default: false },
  dish: { type: Object, default: null },
})

defineEmits(['close', 'edit', 'delete'])

const view = computed(() => (props.dish ? localizedDish(props.dish, locale.value) : null))

const hasRecipe = computed(() => {
  if (!view.value) return false
  return (view.value.ingredients?.length > 0) || (view.value.instructions?.length > 0)
})

const totalTime = computed(() => {
  if (!view.value) return 0
  return (view.value.prepTime || 0) + (view.value.cookTime || 0)
})

// Tabs
const activeTab = ref('details')
watch(
  () => props.show,
  (val) => {
    if (val) {
      activeTab.value = 'details'
      messages.value = []
      input.value = ''
      chatError.value = ''
      lastApplied.value = false
    }
  },
)

// Chat state — local to the modal, not persisted
const messages = ref([]) // [{ role: 'user' | 'model', text: string }]
const input = ref('')
const sending = ref(false)
const chatError = ref('')
const lastApplied = ref(false)
const conversationEl = ref(null)

const SUGGESTION_KEYS = ['swap', 'vegan', 'faster', 'explain']

function suggest(key) {
  if (sending.value) return
  input.value = t(`dishChat.suggestions.${key}`)
  send()
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value || !view.value || !props.dish) return

  messages.value.push({ role: 'user', text })
  input.value = ''
  sending.value = true
  chatError.value = ''
  lastApplied.value = false

  const history = messages.value.slice(0, -1)
  await scrollToBottom()

  const result = await chatAboutDish({
    dish: view.value,
    profile: store.profile,
    history,
    message: text,
    language: locale.value,
  })

  sending.value = false

  if (!result.success) {
    chatError.value = t('dishChat.error', { error: result.error })
    return
  }

  messages.value.push({ role: 'model', text: result.reply })
  await scrollToBottom()

  if (result.updatedDish && props.dish?.id) {
    const ok = store.updateDishById(props.dish.id, result.updatedDish, locale.value)
    if (ok) lastApplied.value = true
  }
}

async function scrollToBottom() {
  await nextTick()
  if (conversationEl.value) {
    conversationEl.value.scrollTop = conversationEl.value.scrollHeight
  }
}

function onInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

const justDisliked = ref(new Set())

function dislikeIngredient(name) {
  if (!name) return
  store.addDislikedIngredient(name)
  justDisliked.value = new Set([...justDisliked.value, name.toLowerCase()])
}
</script>

<template>
  <BaseModal :show="show" size="lg" :title="view?.name || t('dishDetail.title')" @close="$emit('close')">
    <div v-if="view" class="detail">
      <div class="detail__pills">
        <span class="pill pill--accent tabular">
          <Flame :size="12" />
          {{ view.calories }} {{ t('common.kcal') }}
        </span>
        <span class="pill tabular">
          <Clock :size="12" />
          {{ view.time }}
        </span>
        <span v-if="totalTime" class="pill tabular">{{ totalTime }} {{ t('common.min') }}</span>
        <span v-if="view.servings > 1" class="pill tabular">
          <Users :size="12" />
          {{ view.servings }} {{ t('common.servings') }}
        </span>
      </div>

      <div class="tabs">
        <button type="button" :class="['tabs__btn', { 'is-active': activeTab === 'details' }]" @click="activeTab = 'details'">
          {{ t('dishDetail.tabDetails') }}
        </button>
        <button type="button" :class="['tabs__btn', { 'is-active': activeTab === 'chat' }]" @click="activeTab = 'chat'">
          <MessageCircle :size="12" /> {{ t('dishDetail.tabChat') }}
        </button>
      </div>

      <!-- Details tab -->
      <div v-show="activeTab === 'details'" class="detail__pane">
        <div class="detail__macros">
          <div class="macro"><span class="macro__label">{{ t('summary.protein') }}</span><span class="macro__value tabular">{{ view.protein }} {{ t('common.g') }}</span></div>
          <div class="macro"><span class="macro__label">{{ t('summary.carbs') }}</span><span class="macro__value tabular">{{ view.carbs }} {{ t('common.g') }}</span></div>
          <div class="macro"><span class="macro__label">{{ t('summary.fat') }}</span><span class="macro__value tabular">{{ view.fat }} {{ t('common.g') }}</span></div>
        </div>

        <p v-if="view.notes" class="detail__notes">{{ view.notes }}</p>

        <div v-if="view.ingredients?.length > 0" class="detail__section">
          <h3 class="detail__heading">{{ t('dishDetail.ingredients') }}</h3>
          <ul class="ingredients">
            <li
              v-for="(ing, i) in view.ingredients"
              :key="i"
              :class="{ 'is-disliked': justDisliked.has((ing.name || '').toLowerCase()) }"
            >
              <span class="ingredients__bullet" />
              <span class="ingredients__name">{{ ing.name }}</span>
              <span v-if="ing.amount" class="ingredients__amount">{{ ing.amount }}</span>
              <button
                v-if="ing.name"
                type="button"
                class="ingredients__dislike"
                :title="justDisliked.has(ing.name.toLowerCase()) ? t('dishDetail.ingredientDisliked') : t('dishDetail.dislikeIngredient')"
                :disabled="justDisliked.has(ing.name.toLowerCase())"
                @click="dislikeIngredient(ing.name)"
              >
                <Ban :size="13" />
              </button>
            </li>
          </ul>
        </div>

        <div v-if="view.instructions?.length > 0" class="detail__section">
          <h3 class="detail__heading">{{ t('dishDetail.instructions') }}</h3>
          <ol class="instructions">
            <li v-for="(step, i) in view.instructions" :key="i">
              <span class="instructions__num tabular">{{ i + 1 }}</span>
              <span>{{ step }}</span>
            </li>
          </ol>
        </div>

        <p v-if="!hasRecipe && !view.notes" class="detail__empty">{{ t('dishDetail.noRecipe') }}</p>
      </div>

      <!-- Chat tab -->
      <div v-show="activeTab === 'chat'" class="detail__pane chat">
        <p class="chat__intro">{{ t('dishChat.intro') }}</p>

        <Transition name="fade">
          <div v-if="lastApplied" class="chat__applied">
            <Check :size="14" />
            <div>
              <p class="chat__applied-title">{{ t('dishChat.appliedTitle') }}</p>
              <p class="chat__applied-sub">{{ t('dishChat.appliedSub') }}</p>
            </div>
          </div>
        </Transition>

        <div ref="conversationEl" class="chat__conversation">
          <p v-if="messages.length === 0" class="chat__empty">{{ t('dishChat.empty') }}</p>
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="chat__msg"
            :class="`chat__msg--${m.role}`"
          >
            {{ m.text }}
          </div>
          <div v-if="sending" class="chat__msg chat__msg--model chat__msg--thinking">
            <Loader2 :size="12" class="spin" />
            {{ t('dishChat.thinking') }}
          </div>
        </div>

        <div v-if="messages.length === 0" class="chat__suggestions">
          <button
            v-for="key in SUGGESTION_KEYS"
            :key="key"
            type="button"
            class="chat__suggestion"
            :disabled="sending"
            @click="suggest(key)"
          >
            <Sparkles :size="11" />
            {{ t(`dishChat.suggestions.${key}`) }}
          </button>
        </div>

        <p v-if="chatError" class="chat__error">{{ chatError }}</p>

        <div class="chat__input-row">
          <textarea
            v-model="input"
            class="app-input chat__input"
            rows="2"
            :placeholder="t('dishChat.placeholder')"
            :disabled="sending"
            @keydown="onInputKeydown"
          />
          <button
            type="button"
            class="app-btn app-btn--primary chat__send"
            :disabled="sending || !input.trim()"
            @click="send"
          >
            <Send :size="14" />
            <span class="chat__send-label">{{ t('dishChat.send') }}</span>
          </button>
        </div>
      </div>

      <footer class="detail__footer">
        <button type="button" class="app-btn app-btn--ghost" @click="$emit('delete', dish)">
          <Trash2 :size="14" /> {{ t('common.delete') }}
        </button>
        <button type="button" class="app-btn app-btn--primary" @click="$emit('edit', dish)">
          <Pencil :size="14" /> {{ t('common.edit') }}
        </button>
      </footer>
    </div>
  </BaseModal>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background-color: var(--surface-2);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.pill--accent {
  background-color: var(--accent-tint);
  color: var(--accent);
  border-color: transparent;
}

[data-theme='dark'] .pill--accent {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.tabs {
  display: inline-flex;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
  align-self: flex-start;
}

.tabs__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tabs__btn.is-active {
  background-color: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.detail__pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail__macros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  gap: 12px;
}

.macro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.macro__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  font-weight: 600;
}

.macro__value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.detail__notes {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
  background-color: var(--surface-2);
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent);
}

.detail__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail__heading {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--text-faint);
}

.ingredients {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ingredients li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  color: var(--text);
}

.ingredients__bullet {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background-color: var(--accent);
  flex-shrink: 0;
  align-self: center;
}

.ingredients__name {
  flex: 1;
  font-weight: 500;
}

.ingredients__amount {
  color: var(--text-faint);
  font-size: 12px;
}

.ingredients__dislike {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.ingredients li:hover .ingredients__dislike {
  opacity: 1;
}

@media (hover: none) {
  .ingredients__dislike {
    opacity: 0.7;
  }
}

.ingredients__dislike:hover:not(:disabled) {
  color: var(--danger);
  background-color: var(--danger-tint);
}

.ingredients__dislike:disabled {
  opacity: 1;
  color: var(--danger);
  cursor: default;
}

.ingredients li.is-disliked .ingredients__name,
.ingredients li.is-disliked .ingredients__amount {
  text-decoration: line-through;
  color: var(--text-faint);
}

.instructions {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.instructions li {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.55;
}

.instructions__num {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--accent-tint);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

[data-theme='dark'] .instructions__num {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.detail__empty {
  text-align: center;
  font-size: 13px;
  color: var(--text-faint);
  padding: 16px;
}

.detail__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

/* Chat tab */
.chat {
  gap: 14px;
}

.chat__intro {
  font-size: 12px;
  color: var(--text-faint);
}

.chat__applied {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  background-color: var(--accent-tint);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: var(--radius-sm);
  color: var(--accent);
}

[data-theme='dark'] .chat__applied {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
}

.chat__applied-title {
  font-size: 13px;
  font-weight: 600;
}

.chat__applied-sub {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0.85;
}

.chat__conversation {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 220px;
  max-height: 360px;
  overflow-y: auto;
  padding: 14px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.chat__empty {
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
  padding: 24px 0;
}

.chat__msg {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.chat__msg--user {
  align-self: flex-end;
  background-color: var(--accent);
  color: var(--accent-fg);
  border-bottom-right-radius: 4px;
}

.chat__msg--model {
  align-self: flex-start;
  background-color: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-bottom-left-radius: 4px;
}

.chat__msg--thinking {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chat__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chat__suggestion {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.chat__suggestion:hover:not(:disabled) {
  background-color: var(--accent-tint);
  color: var(--accent);
  border-color: var(--accent);
}

.chat__suggestion:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat__error {
  font-size: 12px;
  color: var(--danger);
}

.chat__input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat__input {
  flex: 1;
  resize: none;
}

.chat__send {
  flex-shrink: 0;
}

@media (max-width: 540px) {
  .chat__send-label {
    display: none;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
