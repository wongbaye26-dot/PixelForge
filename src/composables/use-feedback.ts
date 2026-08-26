import { useMessage } from 'naive-ui'

export function useFeedback() {
  const message = useMessage()

  return {
    success(content: string) {
      message.success(content, { duration: 2400 })
    },
    warning(content: string) {
      message.warning(content, { duration: 2800 })
    },
    error(content: string) {
      message.error(content, { duration: 3200 })
    },
  }
}
