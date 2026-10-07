import { request } from './api.js'

export const authService = {
  async login(credentials) {
    return (await request('/auth/login', {
      method: 'POST',
      body: credentials,
      auth: false,
      handleUnauthorized: false,
    })).data
  },
  async register(details) {
    return (await request('/auth/register', {
      method: 'POST',
      body: details,
      auth: false,
      handleUnauthorized: false,
    })).data
  },
  async getMe() {
    return (await request('/auth/me')).data.user
  },
}
