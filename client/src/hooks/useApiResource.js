import { useCallback, useEffect, useState } from 'react'

export function useApiResource(loader, dependencies = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await loader())
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}
