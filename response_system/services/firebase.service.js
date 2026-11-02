const {initializeApp} = require("firebase/app")
const { getFirestore, collection, addDoc, getDocs, query, where, getDoc, deleteDoc, doc, updateDoc, } = require("firebase/firestore")
const config = require("../config/config")
const { cleanUndefined } = require("../utils/cleanups")
const memoryStore = require("./memory.store")


function firebaseReady() {
    const firebase = config.firebase || {}
    return Boolean(firebase.apiKey && firebase.projectId)
}

class FB{

    constructor(){
        this.memory = !firebaseReady()
        if (this.memory) {
            console.log("Firebase is not configured. Using in-memory chat and report storage.")
            return
        }
        try {
            const app = initializeApp(config.firebase)
            this.db = getFirestore(app)
        } catch (err) {
            console.log("Firebase init failed, using in-memory storage.", err.message)
            this.memory = true
        }
    }
/**
 * 
 * @param {string } collectionName 
 * @param { object } data 
 * @returns { any }
 */
    async createOne(collectionName, data){
        if (this.memory) return memoryStore.createOne(collectionName, data)
        let cleaned = cleanUndefined(data)
        return addDoc(collection(this.db, collectionName), cleaned)
    }

    /**
     * 
     * @param {*} collectionName 
     * @returns { any }
     */

    async getAll(collectionName, condition ={}){
        if (this.memory) return memoryStore.getAll(collectionName, condition)
        const cond = Object.entries(condition)[0]
        const meta = cond? where(cond[0], "==", cond[1]): undefined
        const q = meta
            ? query(collection(this.db, collectionName), meta)
            : query(collection(this.db, collectionName))
        return getDocs(q)
    }

    async queryCollection(collectionName, lh, op, rh){
        if (this.memory) return memoryStore.queryCollection(collectionName, lh, op, rh)
        if(!lh || !op || !rh)throw Error("invalid firebase query")
        const operations = ["<", ">", "<=", ">=", "==", "<=", "!="]
        if(!operations.includes(op))throw Error(`firebase query error: query operator can only be (${operations.join(", ")})`)
        const q = query(collection(this.db, collectionName), where(lh,op, rh))
        return getDocs(q)
    }

    /**
     * 
     * @param {string} collectionName 
     * @param {string} id 
     * @returns 
     */

    getById(collectionName, id){
        if (this.memory) return memoryStore.getById(collectionName, id)
        return getDoc(doc(this.db,`${collectionName}/${id}`))
    }

    /**
     * 
     * @param {string} collectionName 
     * @param { string } id 
     * @param { (object)=>Promise<any>} func 
     */
    async updateOne(collectionName, id, func){
        if (this.memory) return memoryStore.updateOne(collectionName, id, func)
        const target = await this.getById(collectionName, id)
        if(!target)return;
        const docRef = doc(this.db, `/${collectionName}/${id}`)
        const update = await func({...target.data(), id: target.id})
        return updateDoc(docRef, update)
    }

    deleteOne(collectionName, id){
        if (this.memory) return memoryStore.deleteOne(collectionName, id)
        return deleteDoc(doc(this.db,`${collectionName}/${id}`))
    }

}

const fb = new FB()

module.exports = Object.freeze(fb)
