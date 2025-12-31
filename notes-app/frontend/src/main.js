import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import ViewNotes from './components/ViewNotes.vue'
import QuestionAnswer from './components/QuestionAnswer.vue'
import ImportYouTubeChannel from './components/ImportYouTubeChannel.vue'

const routes = [
  { path: '/', redirect: '/view' },
  { path: '/view', component: ViewNotes },
  { path: '/ask', component: QuestionAnswer },
  { path: '/import-youtube', component: ImportYouTubeChannel }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

createApp(App).use(router).mount('#app')