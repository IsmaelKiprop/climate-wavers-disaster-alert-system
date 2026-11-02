const fbService = require("./firebase.service")

const disasterCollection = "Disaster"

class DisasterService{

    async getDisasters(){
        const {docs} = await fbService.getAll(disasterCollection,)
        return docs.map(d=>({...d.data(), id: d.id}))
    }

    async getByDate(start){
        const {docs} = await fbService.queryCollection(disasterCollection, "startDate", ">=", start)
        return docs.map(d=>({...d.data(), id: d.id}))
    }

    async getByType(type){
        const {docs} = await fbService.queryCollection(disasterCollection, "disasterType", "==", type)
        return docs.map(d=>({...d.data(), id: d.id}))
    }

    async getByStatus(status){
        const {docs} = await fbService.queryCollection(disasterCollection, "status", "==", status)
        return docs.map(d=>({...d.data(), id: d.id}))
    }

    async getById(id){
        const doc = await fbService.getById(disasterCollection, id)
        const data = typeof doc?.data === "function" ? doc.data() : doc
        if (!data) return null
        return { ...data, id: doc.id || id }
    }

    async createDisaster(obj){
        try{
            const doc = await fbService.createOne(disasterCollection, {...obj})
            const data = await fbService.getById(disasterCollection,doc.id)
            
            return {...data.data(), id: data.id}
        }catch(err){
            console.log({err})
            throw err
        }
    }

    async deleteDisaster(id){
        const res = await fbService.deleteOne(disasterCollection, id)
        return res
    }

    async updateOne(id, updates){
        const updatedDoc = await fbService.updateOne(disasterCollection, id, (doc)=>({...doc, ...updates}))
        return updatedDoc
    }

    
}

module.exports = Object.freeze(new DisasterService())