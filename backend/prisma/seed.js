require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME || 'mukul'
  const password = process.env.ADMIN_PASSWORD || 'mks78955'

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    console.log(`User "${username}" already exists, skipping seed.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({ data: { username, passwordHash } })
  console.log(`Admin user created — username: "${username}"`)
  console.log('Login karke turant password change/naya user bana lena, ye seed sirf pehli baar ke liye hai.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())