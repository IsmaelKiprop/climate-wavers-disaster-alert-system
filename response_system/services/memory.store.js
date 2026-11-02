const { randomUUID } = require("crypto")

const collections = new Map()

function collection(name) {
    if (!collections.has(name)) collections.set(name, new Map())
    return collections.get(name)
}

function snapshot(id, row) {
    return {
        id,
        exists: () => Boolean(row),
        data: () => (row ? { ...row } : undefined),
    }
}

class MemoryStore {
    async createOne(collectionName, data) {
        const id = randomUUID()
        collection(collectionName).set(id, { ...data })
        return { id }
    }

    async getAll(collectionName, condition = {}) {
        const entries = [...collection(collectionName).entries()]
        const filter = Object.entries(condition || {})[0]
        const docs = entries
            .filter(([, row]) => {
                if (!filter) return true
                const [key, value] = filter
                return String(row?.[key]) === String(value)
            })
            .map(([id, row]) => snapshot(id, row))
        return { docs }
    }

    async queryCollection(collectionName, lh, op, rh) {
        const operations = {
            "==": (left, right) => String(left) === String(right),
            "!=": (left, right) => String(left) !== String(right),
            ">": (left, right) => left > right,
            ">=": (left, right) => left >= right,
            "<": (left, right) => left < right,
            "<=": (left, right) => left <= right,
        }
        const compare = operations[op]
        if (!compare) throw Error("invalid memory query")
        const docs = [...collection(collectionName).entries()]
            .filter(([, row]) => compare(row?.[lh], rh))
            .map(([id, row]) => snapshot(id, row))
        return { docs }
    }

    getById(collectionName, id) {
        return snapshot(id, collection(collectionName).get(id))
    }

    async updateOne(collectionName, id, func) {
        const current = collection(collectionName).get(id)
        if (!current) return
        const update = await func({ ...current, id })
        const { id: _ignored, ...rest } = update || {}
        collection(collectionName).set(id, rest)
        return snapshot(id, rest)
    }

    deleteOne(collectionName, id) {
        collection(collectionName).delete(id)
        return true
    }
}

module.exports = new MemoryStore()
