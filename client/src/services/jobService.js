import { queryString, request } from './api.js'

export const jobService = {
  async getJobs(params) {
    return (await request(`/jobs${queryString({ limit: 100, ...params })}`)).data
  },
  async getJobBySlug(slug) {
    return (await request(`/jobs/${encodeURIComponent(slug)}`)).data
  },
  async createJob(job) {
    return (await request('/jobs', { method: 'POST', body: job })).data
  },
  async updateJob(id, changes) {
    return (await request(`/jobs/${encodeURIComponent(id)}`, { method: 'PUT', body: changes })).data
  },
  async deleteJob(id) {
    return (await request(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })).data
  },
}
