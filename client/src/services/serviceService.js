import { queryString, request } from './api.js'

export const serviceService = {
  async getServices(params) {
    return (await request(`/services${queryString({ limit: 100, ...params })}`)).data
  },
  async getServiceBySlug(slug) {
    return (await request(`/services/${encodeURIComponent(slug)}`)).data
  },
  async createService(service) {
    return (await request('/services', { method: 'POST', body: service })).data
  },
  async updateService(id, changes) {
    return (await request(`/services/${encodeURIComponent(id)}`, { method: 'PUT', body: changes })).data
  },
  async deleteService(id) {
    return (await request(`/services/${encodeURIComponent(id)}`, { method: 'DELETE' })).data
  },
}
