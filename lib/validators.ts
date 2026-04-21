import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})

export const calculationSchema = z.object({
  stockSymbol: z.string().min(1),
  quantity: z.number().positive(),
  buyPrice: z.number().positive(),
  sellPrice: z.number().positive().optional(),
  fees: z.number().min(0),
})

export const advancedCalculationSchema = z.object({
  stockSymbol: z.string().min(1),
  quantity: z.number().int().positive(),
  buyPricePerShare: z.number().positive(),
  sellPricePerShare: z.number().positive().optional(),
  feeBuyPercentage: z.number().min(0).default(0.19),
  feeSellPercentage: z.number().min(0).default(0.29),
  targetProfitPercentage: z.number().positive().optional(),
  cutLossPercentage: z.number().positive().optional(),
  modal: z.number().positive(),
  feeBuyAmount: z.number().min(0),
  profitNetto: z.number().optional(),
  returnPercentage: z.number().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CalculationInput = z.infer<typeof calculationSchema>
export type AdvancedCalculationInput = z.infer<typeof advancedCalculationSchema>