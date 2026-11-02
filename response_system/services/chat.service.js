const fbService = require('../services/firebase.service')
const aiService = require("../services/ai.service")
const aiConfig = require('../config/ai.config')
const { defaultChatTitle } = require('../constants/defaults')

const messageCollection = "messages"

const getMessagePath = (chatId)=>{
    return `ChatMessages/${chatId}/messages`
}

const chatCollection = "chats"

class ChatService{
    constructor(){

    }
    async postMessage(obj){
        const rObj = {chatId: obj.chatId, body: obj.body, postedBy: obj.userId, postedAt: Date.now()}
        const path = getMessagePath(rObj.chatId)
        const {id} = await fbService.createOne(path, rObj)
        const message = await fbService.getById(path, id)
        return {...message.data(), id: message.id}
    }
    async generateResponse(userId, chatId, body){
        const userMessage = await this.postMessage({userId, body, chatId})
        const aiRes = await aiService.handleChatResponse(chatId, body)
        const aiMessage = await this.postMessage({userId: aiConfig.id, body: aiRes, chatId})
        return {message: userMessage, response: aiMessage};
    }
    async getMessages(chatId){
        const path = getMessagePath(chatId)
        const { docs } = await fbService.getAll(path, {chatId})
        return docs.map(m=>({...m.data(), id: m.id}))
    }

    async getChat(chatId){
        const fRes = await fbService.getById(chatCollection, chatId)
        const data = typeof fRes?.data === "function" ? fRes.data() : fRes
        if (!data) return null
        return {...data, id: fRes?.id || data.id}
    }

    async getChats(userId){
        const fRes = await fbService.getAll(chatCollection, {userId})
        return fRes.docs.map(c=>({...c.data(), id: c.id}))
    }

    async createChat(userId, title=defaultChatTitle){
        const obj = {userId, createdAt: Date.now(), title}
        console.log(obj)
        const { id } = await fbService.createOne(chatCollection, obj)
        const chat = await fbService.getById(chatCollection, id)
        return {...chat.data(), id: chat.id}
    }

    async updateChatTitle(chatId, title){
        await fbService.updateOne(chatCollection, chatId, (data)=>{
            data["title"] = title
            return data
        })
    }

    async formatConversation(chatId){
        if(!chatId)return 
        let conversation = ""
        const messages = await this.getMessages(chatId)
        if(!messages?.length)return
        for(let i = 0; i < messages.length; i++){
            const messageObj = messages[i]
            conversation += `${messageObj.postedBy == aiConfig.id? aiConfig.username: "User"}: ${messageObj.body} \n`
        }   
        return conversation
    }
}

const chatService = new ChatService()

module.exports = Object.freeze(chatService)