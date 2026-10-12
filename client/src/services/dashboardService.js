import { request } from './api.js'

export const dashboardService = {
  async getSummary() {
    return (await request('/dashboard/summary')).data
  },
}
