import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const eliteOp = await prisma.meritType.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            name: 'Elite Op',
            description: 'Elite Operatiopn',
            value: 2,
        },
    })
    const interCasOp = await prisma.meritType.upsert({
        where: { id: 2 },
        update: {},
        create: {
            id: 2,
            name: 'Intermediat/Casual Op',
            description: 'Intermediat/Casual Operatiopn',
            value: 1,
        },
    })
};
main()
.then(async () => {
    await prisma.$disconnect()
})
.catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
})
