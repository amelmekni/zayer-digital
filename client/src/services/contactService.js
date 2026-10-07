import { queryString, request } from './api.js'

export const contactService = {
  async createContact(message) {
    return (await request('/contact', { method: 'POST', body: message })).data
  },
  async getContacts(params = {}) {
    return (await request(`/contact${queryString({ limit: 100, ...params })}`)).data
  },
  async getContactById(id) {
    return (await request(`/contact/${encodeURIComponent(id)}`)).data
  },
  async updateContact(id, changes) {
    return (await request(`/contact/${encodeURIComponent(id)}`, { method: 'PUT', body: changes })).data
  },
}
