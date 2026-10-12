import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { dashboardService } from '../../services/dashboardService.js'
import { quoteService } from '../../services/quoteService.js'
import { retainerCollectionService } from '../../services/retainerCollectionService.js'
import { serviceService } from '../../services/serviceService.js'
import { userService } from '../../services/userService.js'
import { ErrorState, LoadingState } from '../../components/common/ApiStates.jsx'
import {
  getOrCreatePendingPaymentOperation,
  loadPendingPaymentOperations,
  removePendingPaymentOperation,
} from '../../utils/paymentIdempotency.js'

const emptyLine = () => ({
  kind: 'custom',
  title: '',
  description: '',
  unit: 'service',
  quantity: '1',
  unitPrice: '0',
  monthlyPrice: '0',
  includedMonths: '0',
  contractMonths: '1',
  startDelayMonths: '0',
})

const emptyQuote = () => ({
  client: { name: '', company: '', email: '', phone: '', address: '' },
  proposal: '',
  currency: 'TND',
  paymentTerms: '',
  discountAmount: '0',
  taxRate: '0',
  depositRate: '0',
  lineItems: [emptyLine()],
})

const emptyService = () => ({
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  category: 'marketing',
  unit: 'service',
  price: '',
  currency: 'TND',
  isActive: true,
})

function money(amount, currency) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `— ${currency || ''}`
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'TND',
  }).format(value)
}

function quoteFormFrom(quote) {
  return {
    client: { ...quote.client },
    proposal: quote.proposal || '',
    currency: quote.currency,
    paymentTerms: quote.paymentTerms || '',
    discountAmount: String(quote.discountAmount),
    taxRate: String(quote.taxRate),
    depositRate: String(quote.depositRate),
    lineItems: quote.lineItems.map((item) => ({
      kind: item.kind,
      serviceId: item.service || '',
      title: item.title,
      description: item.description || '',
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      monthlyPrice: String(item.monthlyPrice || 0),
      includedMonths: String(item.includedMonths || 0),
      contractMonths: String(item.contractMonths || 1),
      startDelayMonths: String(item.startDelayMonths || 0),
    })),
  }
}

function payloadForQuote(form) {
  return {
    client: form.client,
    proposal: form.proposal,
    currency: form.currency,
    paymentTerms: form.paymentTerms,
    discountAmount: Number(form.discountAmount),
    taxRate: Number(form.taxRate),
    depositRate: Number(form.depositRate),
    lineItems: form.lineItems.map((item) => item.kind === 'service'
      ? { kind: 'service', serviceId: item.serviceId, quantity: Number(item.quantity) }
      : {
        kind: item.kind,
        title: item.title,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        ...(item.kind === 'retainer' && {
          monthlyPrice: Number(item.monthlyPrice),
          includedMonths: Number(item.includedMonths),
          contractMonths: Number(item.contractMonths),
          startDelayMonths: Number(item.startDelayMonths),
        }),
      }),
  }
}

export default function SalesDashboard() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const copy = t.workspace
  const isAdmin = user?.role === 'admin'
  const isSales = isAdmin || user?.role === 'sales_agent'
  const [activeTab, setActiveTab] = useState('overview')
  const [summary, setSummary] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [services, setServices] = useState([])
  const [agents, setAgents] = useState([])
  const [collections, setCollections] = useState([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [quoteForm, setQuoteForm] = useState(emptyQuote)
  const [quoteEditing, setQuoteEditing] = useState(false)
  const [serviceEditing, setServiceEditing] = useState(null)
  const [serviceForm, setServiceForm] = useState(emptyService)
  const [agentForm, setAgentForm] = useState({ name: '', email: '', password: '' })
  const [paymentAmounts, setPaymentAmounts] = useState({})
  const [pendingPaymentOperations, setPendingPaymentOperations] = useState([])

  const refresh = useCallback(async () => {
    if (!isSales) return
    setLoading(true)
    setError('')
    try {
      const results = await Promise.all([
        dashboardService.getSummary(),
        quoteService.getQuotes(isAdmin && selectedAgentId ? { agentId: selectedAgentId } : undefined),
        retainerCollectionService.getCollections(),
        isAdmin ? serviceService.getManageServices() : serviceService.getServices(),
        isAdmin ? userService.getUsers({ role: 'sales_agent' }) : Promise.resolve({ data: [] }),
      ])
      setSummary(results[0])
      setQuotes(results[1] || [])
      setCollections(results[2] || [])
      setServices(results[3] || [])
      setAgents(results[4] || [])
    } catch (requestError) {
      setError(copy.genericError)
      if (import.meta.env.DEV) {
        console.error('Sales workspace request failed', {
          name: requestError?.name || 'Error',
          status: Number.isInteger(requestError?.status) ? requestError.status : undefined,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [copy.genericError, isAdmin, isSales, selectedAgentId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    try {
      setPendingPaymentOperations(loadPendingPaymentOperations(window.localStorage, user?.id))
    } catch (storageError) {
      setError(storageError.message)
    }
  }, [user?.id])

  const notify = async (operation) => {
    setError('')
    setNotice('')
    try {
      await operation()
      setNotice(copy.saveSuccess)
      await refresh()
      return true
    } catch (requestError) {
      setError(requestError?.name === 'PaymentStorageError'
        ? requestError.message
        : requestError?.status === 400 || requestError?.status === 409
        ? requestError.message
        : copy.genericError)
      if (import.meta.env.DEV) {
        console.error('Sales workspace action failed', {
          name: requestError?.name || 'Error',
          status: Number.isInteger(requestError?.status) ? requestError.status : undefined,
        })
      }
      return false
    }
  }

  const openNewQuote = () => {
    setSelectedQuote(null)
    setQuoteForm(emptyQuote())
    setQuoteEditing(true)
  }

  const openQuote = async (quote) => {
    setError('')
    try {
      const fullQuote = await quoteService.getQuote(quote._id)
      setSelectedQuote(fullQuote)
      setQuoteEditing(false)
    } catch (requestError) {
      setError(requestError?.status === 404 ? requestError.message : copy.genericError)
    }
  }

  const saveQuote = (event) => {
    event.preventDefault()
    const payload = payloadForQuote(quoteForm)
    void notify(async () => {
      const result = selectedQuote
        ? await quoteService.updateQuote(selectedQuote._id, payload)
        : await quoteService.createQuote(payload)
      setSelectedQuote(result)
      setQuoteEditing(false)
    })
  }

  const saveService = (event) => {
    event.preventDefault()
    const payload = {
      title: serviceForm.title,
      slug: serviceForm.slug,
      shortDescription: serviceForm.shortDescription,
      description: serviceForm.description,
      category: serviceForm.category,
      unit: serviceForm.unit || 'service',
      price: serviceForm.price === '' ? undefined : Number(serviceForm.price),
      currency: serviceForm.currency || 'TND',
      isActive: serviceForm.isActive,
    }
    void notify(async () => {
      if (serviceEditing?._id) await serviceService.updateService(serviceEditing._id, payload)
      else await serviceService.createService(payload)
      setServiceEditing(null)
      setServiceForm(emptyService())
    })
  }

  const createAgent = (event) => {
    event.preventDefault()
    void notify(async () => {
      await userService.createAgent(agentForm)
      setAgentForm({ name: '', email: '', password: '' })
    })
  }

  const retryPendingPayment = (operation) => {
    void notify(async () => {
      if (operation.resourceType === 'quote') {
        const quote = await quoteService.recordPayment(
          operation.resourceId,
          operation.payment,
          operation.idempotencyKey,
        )
        if (selectedQuote?._id === operation.resourceId) setSelectedQuote(quote)
      } else {
        await retainerCollectionService.recordPayment(
          operation.resourceId,
          operation.payment,
          operation.idempotencyKey,
        )
      }
      const remaining = await removePendingPaymentOperation(
        window.localStorage,
        user.id,
        operation.idempotencyKey,
      )
      setPendingPaymentOperations(remaining.filter((item) => item.actorId === user?.id))
    })
  }

  const activeServices = useMemo(
    () => services.filter((service) => service.isActive),
    [services],
  )
  const visiblePendingPaymentOperations = pendingPaymentOperations.filter(
    (operation) => operation.actorId === user?.id,
  )
  const tabs = [
    ['overview', copy.overview],
    ['quotes', copy.quotes],
    ...(isAdmin ? [['services', copy.services], ['agents', copy.agents]] : []),
    ['collections', copy.collections],
  ]

  if (!isSales) {
    return <section className="workspace-page" role="alert"><div className="container"><h1>403</h1><p>{copy.accessDenied}</p></div></section>
  }

  const statusLabel = (status) => ({
    draft: copy.draftStatus,
    sent: copy.sentStatus,
    approved: copy.approvedStatus,
    rejected: copy.rejectedStatus,
    cancelled: copy.cancelledStatus,
  }[status] || status)
  const paymentLabel = (status) => ({
    unpaid: copy.unpaidStatus,
    deposit_paid: copy.depositPaidStatus,
    paid: copy.paidStatus,
  }[status] || status)

  const downloadPdf = async (quote) => {
    await notify(async () => {
      const blob = await quoteService.downloadPdf(quote._id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${quote.quoteNumber}.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }

  return <section className="workspace-page">
    <div className="container workspace-container">
      <div className="workspace-heading">
        <div><span className="eyebrow">{user.name}</span><h1>{copy.title}</h1></div>
        {activeTab === 'quotes' && !selectedAgentId && <button className="button button-dark" type="button" onClick={openNewQuote}>{copy.newQuote}</button>}
      </div>
      <nav className="workspace-tabs" aria-label={copy.title}>
        {tabs.map(([id, label]) => <button
          type="button"
          key={id}
          className={activeTab === id ? 'active' : ''}
          aria-pressed={activeTab === id}
          onClick={() => { setActiveTab(id); setError(''); setNotice('') }}
        >{label}</button>)}
      </nav>
      {error && <ErrorState message={error} onRetry={refresh} />}
      {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
      {loading && <LoadingState label={copy.loading} />}

      {visiblePendingPaymentOperations.length > 0 && <section className="workspace-panel" aria-labelledby="pending-payments-title">
        <h2 id="pending-payments-title">{copy.pendingPayments}</h2>
        <p>{copy.pendingPaymentsHelp}</p>
        <div className="workspace-list">{visiblePendingPaymentOperations.map((operation) => (
          <article className="workspace-list-row" key={operation.idempotencyKey}>
            <span>
              <strong>{operation.resourceType === 'quote' ? copy.quotePayment : copy.installmentPayment}</strong>
              <small>{operation.resourceId} · {operation.payment.amount.toFixed(2)}</small>
              {operation.payment.note && <small>{operation.payment.note}</small>}
            </span>
            <button className="text-link" type="button" onClick={() => retryPendingPayment(operation)}>
              {copy.retryPayment}
            </button>
          </article>
        ))}</div>
      </section>}

      {!loading && activeTab === 'overview' && <section className="workspace-stat-grid" aria-label={copy.overview}>
        {[
          [copy.totalQuotes, summary?.quotes?.total],
          [copy.drafts, summary?.quotes?.drafts],
          [copy.awaiting, summary?.quotes?.awaitingDecision],
          [copy.approved, summary?.quotes?.approved],
          [copy.unpaid, summary?.quotes?.unpaid],
          [copy.depositPaid, summary?.quotes?.depositPaid],
          [copy.overdue, summary?.overdueCollections],
          [copy.upcoming, summary?.upcomingCollections],
          ...(isAdmin ? [[copy.activeAgents, summary?.activeAgents]] : []),
        ].map(([label, value]) => <article className="workspace-stat" key={label}>
          <strong>{Number.isFinite(value) ? value : 0}</strong><span>{label}</span>
        </article>)}
      </section>}

      {!loading && activeTab === 'quotes' && <div className="workspace-two-column">
        <section className="workspace-panel">
          <h2>{copy.quotes}</h2>
          {isAdmin && <label className="field workspace-agent-filter"><span>{copy.agents}</span><select value={selectedAgentId} onChange={(event) => { setSelectedAgentId(event.target.value); setSelectedQuote(null); setQuoteEditing(false) }}>
            <option value="">{copy.allAgents}</option>{agents.map((agent) => <option value={agent._id} key={agent._id}>{agent.name}</option>)}
          </select></label>}
          {quotes.length === 0 && <p className="api-state">{copy.noQuotes}</p>}
          <div className="workspace-list">
            {quotes.map((quote) => <button
              type="button"
              key={quote._id}
              className={`workspace-list-row ${selectedQuote?._id === quote._id ? 'selected' : ''}`}
              onClick={() => openQuote(quote)}
            >
              <span><strong>{quote.quoteNumber}</strong><small>{quote.client.name} · {statusLabel(quote.status)}</small></span>
              <strong>{money(quote.total, quote.currency)}</strong>
            </button>)}
          </div>
        </section>
        <section className="workspace-panel">
          {quoteEditing
            ? <form className="workspace-form" onSubmit={saveQuote}>
              <h2>{selectedQuote ? copy.editQuote : copy.newQuote}</h2>
              <div className="workspace-form-grid">
                <label className="field"><span>{copy.client} *</span><input required minLength="2" maxLength="160" value={quoteForm.client.name} onChange={(event) => setQuoteForm({ ...quoteForm, client: { ...quoteForm.client, name: event.target.value } })} /></label>
                <label className="field"><span>{copy.company}</span><input maxLength="160" value={quoteForm.client.company} onChange={(event) => setQuoteForm({ ...quoteForm, client: { ...quoteForm.client, company: event.target.value } })} /></label>
                <label className="field"><span>{copy.email}</span><input type="email" value={quoteForm.client.email} onChange={(event) => setQuoteForm({ ...quoteForm, client: { ...quoteForm.client, email: event.target.value } })} /></label>
                <label className="field"><span>{copy.phone}</span><input value={quoteForm.client.phone} onChange={(event) => setQuoteForm({ ...quoteForm, client: { ...quoteForm.client, phone: event.target.value } })} /></label>
                <label className="field"><span>{copy.address}</span><input value={quoteForm.client.address} onChange={(event) => setQuoteForm({ ...quoteForm, client: { ...quoteForm.client, address: event.target.value } })} /></label>
                <label className="field"><span>{copy.currency} *</span><input required pattern="[A-Za-z]{3}" maxLength="3" value={quoteForm.currency} onChange={(event) => setQuoteForm({ ...quoteForm, currency: event.target.value.toUpperCase() })} /></label>
              </div>
              <label className="field"><span>{copy.proposal}</span><textarea rows="3" maxLength="10000" value={quoteForm.proposal} onChange={(event) => setQuoteForm({ ...quoteForm, proposal: event.target.value })} /></label>
              <h3>{copy.items}</h3>
              {quoteForm.lineItems.map((item, index) => <fieldset className="workspace-line-item" key={index}>
                <legend>{copy.items} {index + 1}</legend>
                <div className="workspace-form-grid">
                  <label className="field"><span>{copy.itemType}</span><select value={item.kind} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...emptyLine(), kind: event.target.value } : line) })}>
                    <option value="custom">{copy.custom}</option><option value="service">{copy.service}</option><option value="retainer">{copy.retainer}</option>
                  </select></label>
                  {item.kind === 'service'
                    ? <label className="field"><span>{copy.service} *</span><select required value={item.serviceId} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, serviceId: event.target.value } : line) })}>
                      <option value="">—</option>
                      {item.serviceId && !activeServices.some((service) => service._id === item.serviceId) && <option value={item.serviceId}>{item.title} ({copy.inactive})</option>}
                      {activeServices.filter((service) => Number.isFinite(service.price)).map((service) => <option value={service._id} key={service._id}>{service.title} ({money(service.price, service.currency)})</option>)}
                    </select></label>
                    : <label className="field"><span>{copy.titleField} *</span><input required minLength="2" maxLength="160" value={item.title} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, title: event.target.value } : line) })} /></label>}
                  <label className="field"><span>{copy.unit}</span><input required maxLength="40" readOnly={item.kind === 'service'} value={item.kind === 'service' ? services.find((service) => service._id === item.serviceId)?.unit || item.unit || 'service' : item.unit} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, unit: event.target.value } : line) })} /></label>
                  <label className="field"><span>{copy.quantity}</span><input type="number" min="0.01" step="0.01" required value={item.quantity} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, quantity: event.target.value } : line) })} /></label>
                  {item.kind !== 'service' && <label className="field"><span>{copy.unitPrice}</span><input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, unitPrice: event.target.value } : line) })} /></label>}
                  {item.kind === 'retainer' && <>
                    <label className="field"><span>{copy.monthlyPrice}</span><input type="number" min="0" step="0.01" required value={item.monthlyPrice} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, monthlyPrice: event.target.value } : line) })} /></label>
                    <label className="field"><span>{copy.includedMonths}</span><input type="number" min="0" max="120" step="1" value={item.includedMonths} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, includedMonths: event.target.value } : line) })} /></label>
                    <label className="field"><span>{copy.contractMonths}</span><input type="number" min="1" max="120" step="1" value={item.contractMonths} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, contractMonths: event.target.value } : line) })} /></label>
                    <label className="field"><span>{copy.startDelay}</span><input type="number" min="0" max="120" step="1" value={item.startDelayMonths} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, startDelayMonths: event.target.value } : line) })} /></label>
                  </>}
                </div>
                {item.kind !== 'service' && <label className="field"><span>{copy.description}</span><textarea rows="2" value={item.description} onChange={(event) => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.map((line, i) => i === index ? { ...line, description: event.target.value } : line) })} /></label>}
                {quoteForm.lineItems.length > 1 && <button className="text-link" type="button" onClick={() => setQuoteForm({ ...quoteForm, lineItems: quoteForm.lineItems.filter((_, i) => i !== index) })}>{copy.removeItem}</button>}
              </fieldset>)}
              <button className="button button-outline" type="button" onClick={() => setQuoteForm({ ...quoteForm, lineItems: [...quoteForm.lineItems, emptyLine()] })}>{copy.addItem}</button>
              <div className="workspace-form-grid">
                <label className="field"><span>{copy.discount}</span><input type="number" min="0" step="0.01" value={quoteForm.discountAmount} onChange={(event) => setQuoteForm({ ...quoteForm, discountAmount: event.target.value })} /></label>
                <label className="field"><span>{copy.taxRate}</span><input type="number" min="0" max="100" step="0.01" value={quoteForm.taxRate} onChange={(event) => setQuoteForm({ ...quoteForm, taxRate: event.target.value })} /></label>
                <label className="field"><span>{copy.depositRate}</span><input type="number" min="0" max="100" step="0.01" value={quoteForm.depositRate} onChange={(event) => setQuoteForm({ ...quoteForm, depositRate: event.target.value })} /></label>
              </div>
              <label className="field"><span>{copy.paymentTerms}</span><textarea rows="2" value={quoteForm.paymentTerms} onChange={(event) => setQuoteForm({ ...quoteForm, paymentTerms: event.target.value })} /></label>
              <div className="workspace-actions"><button className="button button-dark" type="submit">{copy.save}</button><button className="button button-outline" type="button" onClick={() => setQuoteEditing(false)}>{copy.cancel}</button></div>
            </form>
            : selectedQuote
              ? <article className="workspace-quote-detail">
                <div className="workspace-detail-heading"><div><span className="eyebrow">{selectedQuote.quoteNumber}</span><h2>{selectedQuote.client.name}</h2></div><button className="button button-outline" type="button" onClick={() => { setQuoteForm(quoteFormFrom(selectedQuote)); setQuoteEditing(true) }} disabled={selectedQuote.status !== 'draft'}>{copy.editQuote}</button></div>
                <p>{selectedQuote.client.company}</p>
                <p>{statusLabel(selectedQuote.status)} · {paymentLabel(selectedQuote.paymentStatus)}</p>
                {selectedQuote.proposal && <p className="workspace-proposal">{selectedQuote.proposal}</p>}
                <div className="workspace-list">
                  {selectedQuote.lineItems.map((item) => <div className="workspace-list-row" key={item._id}>
                    <span><strong>{item.title}</strong><small>{item.quantity} {item.unit}{item.kind === 'retainer' ? ` · ${money(item.monthlyPrice, selectedQuote.currency)}/month × ${item.contractMonths}` : ''}</small></span>
                    <strong>{money(Number(item.quantity) * Number(item.unitPrice), selectedQuote.currency)}</strong>
                  </div>)}
                </div>
                <dl className="workspace-totals">
                  <div><dt>{copy.subtotal}</dt><dd>{money(selectedQuote.subtotal, selectedQuote.currency)}</dd></div>
                  <div><dt>{copy.discount}</dt><dd>{money(selectedQuote.discountAmount, selectedQuote.currency)}</dd></div>
                  <div><dt>{copy.tax}</dt><dd>{money(selectedQuote.taxAmount, selectedQuote.currency)}</dd></div>
                  <div><dt>{copy.total}</dt><dd>{money(selectedQuote.total, selectedQuote.currency)}</dd></div>
                  <div><dt>{copy.balance}</dt><dd>{money(selectedQuote.outstandingBalance, selectedQuote.currency)}</dd></div>
                  <div><dt>{copy.recurringTotal}</dt><dd>{money(selectedQuote.monthlyRecurringTotal, selectedQuote.currency)}</dd></div>
                </dl>
                <div className="workspace-actions">
                  <button className="button button-outline" type="button" onClick={() => downloadPdf(selectedQuote)}>{copy.downloadPdf}</button>
                  {selectedQuote.status === 'draft' && <button className="button button-dark" type="button" onClick={() => notify(async () => setSelectedQuote(await quoteService.updateStatus(selectedQuote._id, 'sent')))}>{copy.sendQuote}</button>}
                  {selectedQuote.status === 'sent' && <>
                    <button className="button button-dark" type="button" onClick={() => notify(async () => setSelectedQuote(await quoteService.updateStatus(selectedQuote._id, 'approved')))}>{copy.approve}</button>
                    <button className="button button-outline" type="button" onClick={() => notify(async () => setSelectedQuote(await quoteService.updateStatus(selectedQuote._id, 'rejected')))}>{copy.reject}</button>
                  </>}
                  {['draft', 'sent'].includes(selectedQuote.status) && <button className="button button-outline" type="button" onClick={() => notify(async () => setSelectedQuote(await quoteService.updateStatus(selectedQuote._id, 'cancelled')))}>{copy.cancelQuote}</button>}
                </div>
                {selectedQuote.status === 'approved' && selectedQuote.outstandingBalance > 0 && <form className="workspace-payment-form" onSubmit={(event) => {
                  event.preventDefault()
                  const form = event.currentTarget
                  const data = new FormData(event.currentTarget)
                  const payment = {
                    amount: Number(data.get('amount')),
                    note: String(data.get('note') || ''),
                  }
                  void notify(async () => {
                    const operation = await getOrCreatePendingPaymentOperation(window.localStorage, {
                      actorId: user.id,
                      resourceType: 'quote',
                      resourceId: selectedQuote._id,
                      payment,
                    })
                    setPendingPaymentOperations(loadPendingPaymentOperations(window.localStorage, user.id))
                    const quote = await quoteService.recordPayment(
                      operation.resourceId,
                      operation.payment,
                      operation.idempotencyKey,
                    )
                    const remaining = await removePendingPaymentOperation(
                      window.localStorage,
                      user.id,
                      operation.idempotencyKey,
                    )
                    setPendingPaymentOperations(remaining.filter((item) => item.actorId === user.id))
                    setSelectedQuote(quote)
                    form.reset()
                  })
                }}>
                  <h3>{copy.recordPayment}</h3>
                  <label className="field"><span>{copy.amount}</span><input name="amount" type="number" min="0.01" max={selectedQuote.outstandingBalance} step="0.01" required /></label>
                  <label className="field"><span>{copy.note}</span><input name="note" maxLength="300" /></label>
                  <button className="button button-dark" type="submit">{copy.recordPayment}</button>
                </form>}
              </article>
              : <p className="api-state">{copy.noQuotes}</p>}
        </section>
      </div>}

      {!loading && activeTab === 'services' && isAdmin && <div className="workspace-two-column">
        <section className="workspace-panel">
          <h2>{copy.services}</h2>
          {services.length === 0 && <p className="api-state">{copy.noServices}</p>}
          <div className="workspace-list">{services.map((service) => <article className="workspace-list-row" key={service._id}>
            <span><strong>{service.title}</strong><small>{service.slug} · {service.isActive ? copy.active : copy.inactive}</small></span>
            <span className="workspace-actions">
              <button className="text-link" type="button" onClick={() => { setServiceEditing(service); setServiceForm({ ...service, price: service.price ?? '' }) }}>{copy.editService}</button>
              <button className="text-link" type="button" onClick={() => notify(() => serviceService.updateService(service._id, { isActive: !service.isActive }))}>{service.isActive ? copy.deactivate : copy.reactivate}</button>
            </span>
          </article>)}</div>
        </section>
        <form className="workspace-panel workspace-form" onSubmit={saveService}>
          <h2>{serviceEditing ? copy.editService : copy.createService}</h2>
          <label className="field"><span>{copy.titleField} *</span><input required minLength="2" maxLength="160" value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} /></label>
          <label className="field"><span>Slug *</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={serviceForm.slug} onChange={(event) => setServiceForm({ ...serviceForm, slug: event.target.value })} /></label>
          <label className="field"><span>{copy.category} *</span><select value={serviceForm.category} onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })}>
            {['marketing', 'creative', 'development', 'ecommerce', 'technology', 'strategy'].map((category) => <option key={category} value={category}>{t.categories[category] || category}</option>)}
          </select></label>
          <label className="field"><span>{copy.unit}</span><input maxLength="40" value={serviceForm.unit || 'service'} onChange={(event) => setServiceForm({ ...serviceForm, unit: event.target.value })} /></label>
          <label className="field"><span>{copy.description} *</span><textarea required maxLength="10000" value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} /></label>
          <label className="field"><span>{copy.description} (short) *</span><textarea required maxLength="300" value={serviceForm.shortDescription} onChange={(event) => setServiceForm({ ...serviceForm, shortDescription: event.target.value })} /></label>
          <div className="workspace-form-grid">
            <label className="field"><span>{copy.unitPrice}</span><input type="number" min="0" step="0.01" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} /></label>
            <label className="field"><span>{copy.currency}</span><input maxLength="3" pattern="[A-Za-z]{3}" value={serviceForm.currency || 'TND'} onChange={(event) => setServiceForm({ ...serviceForm, currency: event.target.value.toUpperCase() })} /></label>
          </div>
          <div className="workspace-actions"><button className="button button-dark" type="submit">{copy.save}</button><button className="button button-outline" type="button" onClick={() => { setServiceEditing(null); setServiceForm(emptyService()) }}>{copy.cancel}</button></div>
        </form>
      </div>}

      {!loading && activeTab === 'agents' && isAdmin && <div className="workspace-two-column">
        <section className="workspace-panel">
          <h2>{copy.agents}</h2>
          {agents.length === 0 && <p className="api-state">{copy.noAgents}</p>}
          <div className="workspace-list">{agents.map((agent) => <article className="workspace-list-row" key={agent._id}>
            <span>
              <strong>{agent.name}</strong>
              <small>{agent.email} · {agent.isActive === false ? copy.inactive : copy.active}</small>
              <small>{copy.agentQuotes}: {summary?.agents?.find((stats) => stats._id === agent._id)?.quotesTotal || 0}
                {' · '}{copy.agentAwaiting}: {summary?.agents?.find((stats) => stats._id === agent._id)?.awaitingDecision || 0}
                {' · '}{copy.agentApproved}: {summary?.agents?.find((stats) => stats._id === agent._id)?.approved || 0}
              </small>
            </span>
            <button className="text-link" type="button" onClick={() => { setSelectedAgentId(agent._id); setSelectedQuote(null); setActiveTab('quotes') }}>{copy.viewAgentQuotes}</button>
            <button className="text-link" type="button" onClick={() => notify(() => userService.setAgentActive(agent._id, agent.isActive === false))}>{agent.isActive === false ? copy.reactivate : copy.deactivate}</button>
          </article>)}</div>
        </section>
        <form className="workspace-panel workspace-form" onSubmit={createAgent}>
          <h2>{copy.createAgent}</h2>
          <label className="field"><span>{copy.client} *</span><input required minLength="2" maxLength="100" value={agentForm.name} onChange={(event) => setAgentForm({ ...agentForm, name: event.target.value })} /></label>
          <label className="field"><span>{copy.email} *</span><input type="email" required maxLength="254" value={agentForm.email} onChange={(event) => setAgentForm({ ...agentForm, email: event.target.value })} /></label>
          <label className="field"><span>{copy.password} *</span><input type="password" required minLength="12" maxLength="72" autoComplete="new-password" value={agentForm.password} onChange={(event) => setAgentForm({ ...agentForm, password: event.target.value })} /></label>
          <button className="button button-dark" type="submit">{copy.createAgent}</button>
        </form>
      </div>}

      {!loading && activeTab === 'collections' && <section className="workspace-panel">
        <h2>{copy.collections}</h2>
        {collections.length === 0 && <p className="api-state">{copy.noCollections}</p>}
        <div className="workspace-list">{collections.map((collection) => {
          const amount = paymentAmounts[collection._id] ?? String(collection.outstandingAmount)
          const state = collection.collectionState === 'received' ? copy.stateReceived
            : collection.collectionState === 'overdue' ? copy.stateOverdue
              : collection.collectionState === 'partial' ? copy.statePartial : copy.stateUpcoming
          return <article className="workspace-list-row workspace-collection-row" key={collection._id}>
            <span><strong>{collection.quote?.quoteNumber} · {collection.quote?.client?.name}</strong>
              <small>{state} · {new Date(collection.dueAt).toLocaleDateString()} · {money(collection.amount, collection.quote?.currency)}</small>
            </span>
            {collection.status !== 'paid' && <form className="workspace-collection-payment" onSubmit={(event) => {
              event.preventDefault()
              const payment = {
                amount: Number(paymentAmounts[collection._id] ?? collection.outstandingAmount),
                note: '',
              }
              void notify(async () => {
                const operation = await getOrCreatePendingPaymentOperation(window.localStorage, {
                  actorId: user.id,
                  resourceType: 'retainer_collection',
                  resourceId: collection._id,
                  payment,
                })
                setPendingPaymentOperations(loadPendingPaymentOperations(window.localStorage, user.id))
                await retainerCollectionService.recordPayment(
                  operation.resourceId,
                  operation.payment,
                  operation.idempotencyKey,
                )
                const remaining = await removePendingPaymentOperation(
                  window.localStorage,
                  user.id,
                  operation.idempotencyKey,
                )
                setPendingPaymentOperations(remaining.filter((item) => item.actorId === user.id))
                setPaymentAmounts((current) => {
                  const updated = { ...current }
                  delete updated[collection._id]
                  return updated
                })
              })
            }}>
              <input aria-label={copy.amount} type="number" min="0.01" max={collection.outstandingAmount} step="0.01" value={amount} onChange={(event) => setPaymentAmounts({ ...paymentAmounts, [collection._id]: event.target.value })} />
              <button className="text-link" type="submit">{copy.recordPayment}</button>
            </form>}
          </article>
        })}</div>
      </section>}
    </div>
  </section>
}
