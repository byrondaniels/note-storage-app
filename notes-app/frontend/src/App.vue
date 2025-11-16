<template>
  <div id="app">
    <nav>
      <router-link to="/view">View Notes</router-link>
      <router-link to="/ask">Ask AI</router-link>
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
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin: 0;
  padding: 20px;
}

nav {
  padding: 30px 0;
  text-align: center;
  border-bottom: 2px solid #eee;
  margin-bottom: 30px;
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