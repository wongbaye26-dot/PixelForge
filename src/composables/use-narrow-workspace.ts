import { onMounted, onUnmounted, ref } from 'vue'

const QUERY = '(max-width: 980px)'

export function useNarrowWorkspace() {
  const narrow = ref(false)
  let mq: MediaQueryList | null = null

  function sync() {
    narrow.value = mq?.matches ?? false
  }

  onMounted(() => {
    mq = window.matchMedia(QUERY)
    sync()
    mq.addEventListener('change', sync)
  })

  onUnmounted(() => {
    mq?.removeEventListener('change', sync)
  })

  return { narrow }
}
