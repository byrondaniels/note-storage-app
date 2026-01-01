import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles/index.css'
import ViewNotes from './components/ViewNotes.vue'
import QuestionAnswer from './components/QuestionAnswer.vue'
import ChannelSettings from './components/ChannelSettings.vue'

const routes = [
  { path: '/', redirect: '/view' },
  { path: '/view', component: ViewNotes },
  { path: '/ask', component: QuestionAnswer },
  { path: '/settings', component: ChannelSettings }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

createApp(App).use(router).mount('#app')