import { request } from './api.js'

export const publicQuoteService = {
  async submit(payload) {
    return (await request('/contact/quote-request', {
      method: 'POST',
      body: payload,
      auth: false,
    })).data
  },

  async downloadPdf(payload) {
    return request('/contact/quote-request/pdf', {
      method: 'POST',
      body: payload,
      auth: false,
      responseType: 'blob',
    })
  },
}
