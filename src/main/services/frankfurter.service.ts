import { net } from 'electron'

const ratesCache = new Map<string, Record<string, number>>()
let currenciesCache: Record<string, string> | null = null

export function fetchExchangeRates(baseCode: string): Promise<Record<string, number>> {
  if (ratesCache.has(baseCode)) return Promise.resolve(ratesCache.get(baseCode)!)

  return new Promise<Record<string, number>>((resolve) => {
    try {
      const request = net.request(`https://api.frankfurter.dev/v1/latest?base=${baseCode}`)

      let body = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { body += chunk.toString() })
        response.on('end', () => {
          try {
            const data = JSON.parse(body)
            if (data && data.rates && typeof data.rates === 'object') {
              ratesCache.set(baseCode, data.rates)
              resolve(data.rates)
            } else {
              resolve({})
            }
          } catch {
            resolve({})
          }
        })
      })

      request.on('error', () => {
        resolve({})
      })

      request.end()
    } catch {
      resolve({})
    }
  })
}

export function clearRatesCache(): void {
  ratesCache.clear()
}

export function fetchAvailableCurrencies(): Promise<Record<string, string>> {
  if (currenciesCache) return Promise.resolve(currenciesCache)

  return new Promise<Record<string, string>>((resolve) => {
    try {
      const request = net.request('https://api.frankfurter.dev/v1/currencies')

      let body = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { body += chunk.toString() })
        response.on('end', () => {
          try {
            const data = JSON.parse(body)
            if (data && typeof data === 'object') {
              currenciesCache = data
              resolve(data)
            } else {
              resolve({})
            }
          } catch {
            resolve({})
          }
        })
      })

      request.on('error', () => {
        resolve({})
      })

      request.end()
    } catch {
      resolve({})
    }
  })
}
