import { queryString, request } from './api.js'

export const applicationService = {
  async createApplication(application) {
    return (await request('/applications', { method: 'POST', body: application })).data
  },
  async getApplications(params = {}) {
    return (await request(`/applications${queryString({ limit: 100, ...params })}`)).data
  },
  async getApplicationById(id) {
    return (await request(`/applications/${encodeURIComponent(id)}`)).data
  },
  async updateApplication(id, changes) {
    return (await request(`/applications/${encodeURIComponent(id)}`, { method: 'PUT', body: changes })).data
  },
}
