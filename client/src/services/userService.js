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
  async deleteUser(id) {
    return (await request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' })).data
  },
}
