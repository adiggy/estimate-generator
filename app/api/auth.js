module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pin } = req.body
  const correctPin = process.env.EDIT_PIN || '6350'

  if (pin === correctPin) {
    return res.status(200).json({ success: true })
  }

  return res.status(401).json({ error: 'Invalid PIN' })
}
