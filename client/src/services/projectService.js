import { queryString, request } from './api.js'

export const projectService = {
  async getProjects(params) {
    return (await request(`/projects${queryString({ limit: 100, ...params })}`)).data
  },
  async getProjectBySlug(slug) {
    return (await request(`/projects/${encodeURIComponent(slug)}`)).data
  },
  async createProject(project) {
    return (await request('/projects', { method: 'POST', body: project })).data
  },
  async updateProject(id, changes) {
    return (await request(`/projects/${encodeURIComponent(id)}`, { method: 'PUT', body: changes })).data
  },
  async deleteProject(id) {
    return (await request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })).data
  },
}
