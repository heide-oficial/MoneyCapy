import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface Person {
  id: number
  name: string
  color: string
}

interface ActivePersonContextType {
  activePerson: Person | null
  people: Person[]
  isLoaded: boolean
  setActivePersonId: (id: number) => void
  reloadPeople: () => Promise<void>
  itemsVersion: number
  bumpItems: () => void
}

const ActivePersonContext = createContext<ActivePersonContextType>({
  activePerson: null,
  people: [],
  isLoaded: false,
  setActivePersonId: () => {},
  reloadPeople: async () => {},
  itemsVersion: 0,
  bumpItems: () => {}
})

export function ActivePersonProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Person[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [itemsVersion, setItemsVersion] = useState(0)
  const [activePersonId, setActivePersonIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('moneycapy:activePersonId')
    return saved ? parseInt(saved) : null
  })

  const reloadPeople = useCallback(async () => {
    const list = await window.api.people.list()
    setPeople(list)
    setIsLoaded(true)

    if (list.length > 0) {
      const savedId = activePersonId
      const exists = list.find((p: Person) => p.id === savedId)
      if (!exists) {
        setActivePersonIdState(list[0].id)
        localStorage.setItem('moneycapy:activePersonId', String(list[0].id))
      }
    } else {
      setActivePersonIdState(null)
      localStorage.removeItem('moneycapy:activePersonId')
    }
  }, [activePersonId])

  useEffect(() => {
    reloadPeople()
  }, [])

  const setActivePersonId = (id: number) => {
    setActivePersonIdState(id)
    localStorage.setItem('moneycapy:activePersonId', String(id))
  }

  const bumpItems = useCallback(() => {
    setItemsVersion(v => v + 1)
  }, [])

  const activePerson = people.find(p => p.id === activePersonId) || null

  return (
    <ActivePersonContext.Provider value={{ activePerson, people, isLoaded, setActivePersonId, reloadPeople, itemsVersion, bumpItems }}>
      {children}
    </ActivePersonContext.Provider>
  )
}

export function useActivePerson() {
  return useContext(ActivePersonContext)
}
