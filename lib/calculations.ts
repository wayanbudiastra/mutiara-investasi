export interface AdvancedCalculationInput {
  stockSymbol: string
  quantity: number
  buyPricePerShare: number
  sellPricePerShare?: number
  feeBuyPercentage?: number
  feeSellPercentage?: number
  targetProfitPercentage?: number
  cutLossPercentage?: number
}

export interface CalculationBreakdown {
  quantity: number
  buyPricePerShare: number
  modal: number
  feeBuyPercentage: number
  feeBuyAmount: number
  feeSellPercentage: number
  
  sellPricePerShare?: number
  sellPriceGross?: number
  feeSellAmount?: number
  totalFees?: number
  
  profitBruto?: number
  profitNetto?: number
  returnPercentage?: number
  
  targetProfitPercentage?: number
  cutLossPercentage?: number
  targetSellPrice?: number
  targetSellPriceGross?: number
  targetProfitBruto?: number
  targetFeeSellAmount?: number
  targetProfitNetto?: number
  
  cutLossSellPrice?: number
  cutLossSellPriceGross?: number
  cutLossProfitBruto?: number
  cutLossFeeSellAmount?: number
  cutLossProfitNetto?: number
}

export function calculateAdvancedStockProfit(input: AdvancedCalculationInput): CalculationBreakdown {
  const {
    quantity,
    buyPricePerShare,
    sellPricePerShare,
    feeBuyPercentage = 0.19,
    feeSellPercentage = 0.29,
    targetProfitPercentage,
    cutLossPercentage,
  } = input

  // Calculate modal (cost basis)
  const modal = quantity * buyPricePerShare
  const feeBuyAmount = (modal * feeBuyPercentage) / 100
  const totalModal = modal + feeBuyAmount

  const breakdown: CalculationBreakdown = {
    quantity,
    buyPricePerShare,
    modal,
    feeBuyPercentage,
    feeBuyAmount,
    feeSellPercentage,
    targetProfitPercentage,
    cutLossPercentage,
  }

  // If sell price is provided, calculate profit
  if (sellPricePerShare !== undefined && sellPricePerShare > 0) {
    const sellPriceGross = quantity * sellPricePerShare
    const feeSellAmount = (sellPriceGross * feeSellPercentage) / 100
    const totalFees = feeBuyAmount + feeSellAmount
    const profitBruto = sellPriceGross - modal
    const profitNetto = profitBruto - totalFees
    const returnPercentage = (profitNetto / modal) * 100

    breakdown.sellPricePerShare = sellPricePerShare
    breakdown.sellPriceGross = sellPriceGross
    breakdown.feeSellAmount = feeSellAmount
    breakdown.totalFees = totalFees
    breakdown.profitBruto = profitBruto
    breakdown.profitNetto = profitNetto
    breakdown.returnPercentage = returnPercentage
  }

  // Calculate target sell prices based on target profit % and cut loss %
  if (targetProfitPercentage !== undefined && targetProfitPercentage > 0) {
    const targetProfit = (modal * targetProfitPercentage) / 100
    const targetSellPriceGross = modal + targetProfit + feeBuyAmount
    const targetFeeSellAmount = (targetSellPriceGross * feeSellPercentage) / 100
    const targetSellPricePerShare = (targetSellPriceGross + targetFeeSellAmount) / quantity
    const targetProfitBruto = targetSellPriceGross - modal
    const targetProfitNetto = targetProfitBruto - feeBuyAmount - targetFeeSellAmount
    
    breakdown.targetSellPrice = parseFloat(targetSellPricePerShare.toFixed(2))
    breakdown.targetSellPriceGross = targetSellPriceGross
    breakdown.targetProfitBruto = targetProfitBruto
    breakdown.targetFeeSellAmount = targetFeeSellAmount
    breakdown.targetProfitNetto = targetProfitNetto
  }

  if (cutLossPercentage !== undefined && cutLossPercentage > 0) {
    const cutLossAmount = (modal * cutLossPercentage) / 100
    const cutLossSellPriceGross = modal - cutLossAmount
    const cutLossFeeSellAmount = (cutLossSellPriceGross * feeSellPercentage) / 100
    const cutLossSellPrice = (cutLossSellPriceGross - cutLossFeeSellAmount) / quantity
    const cutLossProfitBruto = cutLossSellPriceGross - modal
    const cutLossProfitNetto = cutLossProfitBruto - feeBuyAmount - cutLossFeeSellAmount
    
    breakdown.cutLossSellPrice = parseFloat(cutLossSellPrice.toFixed(2))
    breakdown.cutLossSellPriceGross = cutLossSellPriceGross
    breakdown.cutLossProfitBruto = cutLossProfitBruto
    breakdown.cutLossFeeSellAmount = cutLossFeeSellAmount
    breakdown.cutLossProfitNetto = cutLossProfitNetto
  }

  return breakdown
}
