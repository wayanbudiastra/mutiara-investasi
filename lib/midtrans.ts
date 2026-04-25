// eslint-disable-next-line @typescript-eslint/no-require-imports
const midtransClient = require('midtrans-client')

export function getSnapClient() {
  if (!process.env.MIDTRANS_SERVER_KEY) {
    throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi')
  }
  return new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
  })
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  receivedSignature: string
): boolean {
  const crypto = require('crypto')
  const hash = crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex')
  return hash === receivedSignature
}
