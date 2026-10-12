import { queryString, request } from './api.js'

export const retainerCollectionService = {
  async getCollections(params) {
    return (await request(`/retainer-collections${queryString({ limit: 100, ...params })}`)).data
  },
  async recordPayment(id, payment, idempotencyKey) {
    return (await request(`/retainer-collections/${encodeURIComponent(id)}/payments`, {
      method: 'POST',
      body: payment,
      headers: { 'Idempotency-Key': idempotencyKey },
    })).data
  },
}
