<script setup lang="ts">
const { csrf, headerName } = useCsrf()
const password = ref("")
const error = ref<string | null>(null)
const pending = ref(false)

async function submit() {
  if (!password.value || pending.value) return
  error.value = null
  pending.value = true
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    // nuxt-csurf protects POSTs — send the token like useHermesChatSend does.
    if (csrf) headers[headerName] = csrf

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ password: password.value })
    })

    if (res.ok) {
      await navigateTo("/")
      return
    }
    error.value = res.status === 401 ? "Wrong password" : `Login failed (${res.status})`
  } catch {
    error.value = "Login failed"
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <UCard class="w-full max-w-sm">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div>
          <h1 class="text-lg font-semibold text-highlighted">Hermes Dash</h1>
          <p class="text-sm text-muted">Enter the dashboard password to continue.</p>
        </div>
        <UInput
          v-model="password"
          type="password"
          name="password"
          placeholder="Password"
          autocomplete="current-password"
          autofocus
          required
        />
        <UButton type="submit" :loading="pending" class="w-full justify-center">
          Login
        </UButton>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
      </form>
    </UCard>
  </div>
</template>
