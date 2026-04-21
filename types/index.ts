export interface User {
  id: string
  email: string
  name?: string
  createdAt: Date
  updatedAt: Date
}

export interface Calculation {
  id: string
  userId: string
  stockSymbol: string
  quantity: number
  buyPrice: number
  sellPrice?: number
  fees: number
  profit?: number
  createdAt: Date
}

export interface WatchlistItem {
  id: string
  userId: string
  stockSymbol: string
  createdAt: Date
}