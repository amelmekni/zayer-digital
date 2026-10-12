import { queryString, request } from './api.js'

export const userService = {
  async getUsers(params) {
    return (await request(`/users${queryString({ limit: 100, ...params })}`)).data
  },
  async getUserById(id) {
    return (await request(`/users/${encodeURIComponent(id)}`)).data
  },
  async updateUser(id, changes) {
    return (await request(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: changes })).data
  },
  async createAgent(agent) {
    return (await request('/users/agents', { method: 'POST', body: agent })).data
  },
  async setAgentActive(id, isActive) {
    return (await request(`/users/agents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { isActive },
    })).data
  },
  async deleteUser(id) {
    return (await request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' })).data
  },
}
