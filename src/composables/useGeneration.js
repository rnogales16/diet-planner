// Shared generation state that lives outside of any component's lifecycle.
// This way the user can navigate away from /generate while a plan is being
// generated, and the fetch keeps running. When it finishes, a global banner
// lets them jump back to /generate to review or apply the result.

import { ref } from 'vue'
import { generateMealPlan } from '@/services/openai'

// Module-level refs — shared across every caller of the composable.
const phase = ref('idle') // idle | loading | preview | error
const plan = ref(null)
const error = ref('')
const errorCode = ref(null) // e.g. 'email_not_verified'
const targetWeekKey = ref('')
const lastFormData = ref(null)
let abortController = null
// Monotonically increasing id so we can ignore stale fetches if the user
// cancels and starts a new generation before the old one finishes.
let runId = 0

export function useGeneration() {
  async function start(formData, weekKey) {
    phase.value = 'loading'
    plan.value = null
    error.value = ''
    errorCode.value = null
    targetWeekKey.value = weekKey
    lastFormData.value = formData

    runId += 1
    const thisRun = runId
    abortController = new AbortController()

    let result
    try {
      result = await generateMealPlan(formData, abortController.signal)
    } catch (err) {
      if (thisRun !== runId) return
      phase.value = 'error'
      error.value = err.message || 'Unknown error'
      return
    }

    // A newer call superseded this one while we were waiting: drop the result.
    if (thisRun !== runId) return

    if (result.success) {
      plan.value = result.data
      phase.value = 'preview'
    } else {
      error.value = result.error
      errorCode.value = result.code || null
      phase.value = 'error'
    }
  }

  function cancel() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    runId += 1 // invalidate whatever was running
    phase.value = 'idle'
    plan.value = null
    error.value = ''
  }

  function clear() {
    runId += 1
    plan.value = null
    error.value = ''
    phase.value = 'idle'
    targetWeekKey.value = ''
    lastFormData.value = null
  }

  function dismissError() {
    if (phase.value === 'error') {
      phase.value = 'idle'
      error.value = ''
    }
  }

  return {
    phase,
    plan,
    error,
    errorCode,
    targetWeekKey,
    lastFormData,
    start,
    cancel,
    clear,
    dismissError,
  }
}
