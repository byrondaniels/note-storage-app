<template>
  <div class="app-container">
    <nav>
      <router-link to="/view">View Notes</router-link>
      <router-link to="/ask">Ask AI</router-link>
      <router-link to="/settings">Settings</router-link>
    </nav>
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
}

#app, .app-container {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 0;
  padding: 0 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

nav {
  padding: 20px 0;
  text-align: center;
  border-bottom: 2px solid #eee;
  flex-shrink: 0;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
  text-decoration: none;
  margin: 0 20px;
  padding: 10px 20px;
  border-radius: 5px;
  transition: background-color 0.3s;
}

nav a:hover {
  background-color: #f0f0f0;
}

nav a.router-link-exact-active {
  color: #42b983;
  background-color: #f0f8f4;
}
</style>