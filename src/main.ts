import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import App from './App.vue'
import './styles/design-tokens.css'
import './styles/global.css'
import './styles/scrollbars.css'
import './styles/pf-components.css'

const app = createApp(App)
app.use(createPinia())
app.use(naive)
app.mount('#app')
