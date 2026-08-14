export type BusEvents = {
  'cart-changed': { count: number }
  'order-created': { orderId: string }
}

type Handler<K extends keyof BusEvents> = (payload: BusEvents[K]) => void

type AnyHandler = (payload: unknown) => void

const listeners: Partial<Record<keyof BusEvents, AnyHandler[]>> = {}

export const eventBus = {
  on<K extends keyof BusEvents>(event: K, handler: Handler<K>) {
    const list: AnyHandler[] = listeners[event] || []
    list.push(handler as unknown as AnyHandler)
    listeners[event] = list
  },

  off<K extends keyof BusEvents>(event: K, handler: Handler<K>) {
    const list = listeners[event]
    if (!list) {
      return
    }

    const index = list.indexOf(handler as unknown as AnyHandler)
    if (index >= 0) {
      list.splice(index, 1)
    }
  },

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]) {
    const list = listeners[event]
    if (!list) {
      return
    }

    list.slice().forEach((handler) => {
      handler(payload)
    })
  },
}
