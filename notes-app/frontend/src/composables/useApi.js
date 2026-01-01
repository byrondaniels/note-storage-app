import { ref } from 'vue'

export const useApi = () => {
  const loading = ref(false)
  const error = ref(null)

  const request = async (fn) => {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e) {
      error.value = e.message
      console.error('API Error:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return { loading, error, request }
}
