import { net } from 'electron'

const cache = new Map<string, string[]>()

export function getHolidays(year: number, countryCode: string): Promise<string[]> {
  const key = `${year}-${countryCode}`
  if (cache.has(key)) return Promise.resolve(cache.get(key)!)

  return new Promise<string[]>((resolve) => {
    try {
      const request = net.request(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`)

      let body = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => { body += chunk.toString() })
        response.on('end', () => {
          try {
            const data = JSON.parse(body)
            if (Array.isArray(data)) {
              const dates = data.map((h: any) => h.date as string)
              cache.set(key, dates)
              resolve(dates)
            } else {
              cache.set(key, [])
              resolve([])
            }
          } catch {
            cache.set(key, [])
            resolve([])
          }
        })
      })

      request.on('error', () => {
        resolve([])
      })

      request.end()
    } catch {
      resolve([])
    }
  })
}
