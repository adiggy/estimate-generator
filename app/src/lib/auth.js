// Shared authentication utilities

export const getAuthToken = () => localStorage.getItem('authToken')

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('authToken', token)
  } else {
    localStorage.removeItem('authToken')
  }
}

export const isAuthenticated = () => !!getAuthToken()

// Helper for authenticated fetch requests
// Automatically clears expired tokens and fires 'auth-expired' so the UI shows login
export const authFetch = async (url, options = {}) => {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    setAuthToken(null)
    window.dispatchEvent(new Event('auth-expired'))
  }
  return res
}
