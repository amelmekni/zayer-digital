import { queryString, request } from './api.js'

export const quoteService = {
  async getQuotes(params) {
    return (await request(`/quotes${queryString({ limit: 100, ...params })}`)).data
  },
  async getQuote(id) {
    return (await request(`/quotes/${encodeURIComponent(id)}`)).data
  },
  async createQuote(quote) {
    return (await request('/quotes', { method: 'POST', body: quote })).data
  },
  async updateQuote(id, quote) {
    return (await request(`/quotes/${encodeURIComponent(id)}`, { method: 'PUT', body: quote })).data
  },
  async updateStatus(id, status) {
    return (await request(`/quotes/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } })).data
  },
  async recordPayment(id, payment, idempotencyKey) {
    return (await request(`/quotes/${encodeURIComponent(id)}/payments`, {
      method: 'POST',
      body: payment,
      headers: { 'Idempotency-Key': idempotencyKey },
    })).data
  },
  async downloadPdf(id) {
    return request(`/quotes/${encodeURIComponent(id)}/pdf`, { responseType: 'blob' })
  },
}
