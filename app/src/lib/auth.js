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
export const authFetch = async (url, options = {}) => {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return fetch(url, { ...options, headers })
}
