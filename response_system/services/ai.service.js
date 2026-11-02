
const config = require("../config/config")
const postCategories = require("../constants/post_categories")
const OpenAI = require("openai");
const { cleanText } = require("../utils/cleanups");
const aiConfig = require("../config/ai.config");
const {formatConversation} = require("../utils/factory");
const { logBuilder } = require("../lib/log");


function localReply(prompt = "") {
    const clipped = String(prompt).replace(/\s+/g, " ").slice(0, 280)
    return `I'm WaverX at Climate Wavers in Nairobi. We verify alerts before amplifying them. Live events come from USGS and NASA EONET. ${clipped ? `I read: "${clipped}". ` : ""}Treat social posts as claims until source, location, time, and a human review check out.`
}

class AI{
    constructor(){
        this.openai = config.openai.apiKey
            ? new OpenAI({ apiKey: config.openai.apiKey })
            : null;
        this.promptCategories = postCategories

        this.usePrePrompt = (prompt, prevConversation, appLogs)=>{
            return `you are integrated as an AI chatbot named ${aiConfig.username} for a climate mitigation app "Climate wavers", generate a response for this prompt "${prompt}".${prevConversation && `generate your response based on previous conversation (if necessary) shown below: \n ${prevConversation}`}${appLogs && `. Also generate response from activities from the app using the logs below is applicable: ${appLogs}`}. respond with only the generated response, no label (e.g waver-x), and keep it brief and concise`
        }

        this.execGemini = async function(prompt) {
            const key = config.gemini?.apiKey
            if (!key) return null
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            })
            if (!response.ok) {
                throw new Error(`Gemini HTTP ${response.status}`)
            }
            const payload = await response.json()
            return payload?.candidates?.[0]?.content?.parts?.[0]?.text || null
        }

        this.exec = async function(prompt, imageUrl = undefined) {
            if (this.openai) {
                try {
                    const messages = [
                        {
                            role: "user",
                            content: imageUrl ? [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: imageUrl } }
                            ] : prompt
                        }
                    ];

                    const completion = await this.openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: messages,
                        max_tokens: 1000,
                        temperature: 0.7
                    });

                    return cleanText(completion.choices[0].message.content);
                } catch(err) {
                    console.log(`OpenAI Error: ${err.message} \n${err} `)
                }
            }

            try {
                const geminiText = await this.execGemini(prompt)
                if (geminiText) return cleanText(geminiText)
            } catch (err) {
                console.log(`Gemini Error: ${err.message}`)
            }

            return localReply(prompt)
        }
    }

    async checkChatCategory(message, image=undefined){
        const prompt = `consider this list ${this.promptCategories}, categorize this message "${message}" ${image && "with image attached "}and return the index of the category in the given list. respond strictly with only the index. e.g 0. No explanation is expected in your response`
        return this.exec(prompt)
    }

    async handleChatResponse(chatId, text, imageFile){
        const conversation = await formatConversation(chatId)
        const appLogs = await logBuilder.formatLogs()
        const prompt = this.usePrePrompt(text, conversation, appLogs)
        return this.exec(prompt, imageFile)
    }

    async getPossibleAffectedLocations(disaster, location){
        const prompt = `generate an array of locations that can be affected by a/an ${disaster} in ${location}. reponse should strictly look like this [LA, freetown, Lagos], no further explanation is expected in your response.`
        const aiRes = await this.exec(prompt)
        const startIndx = aiRes.indexOf("[")
        const endIndex = aiRes.indexOf("]")
        const statesArr = aiRes.slice(startIndx + 1, endIndex)
        return statesArr.split(",")
    }

    generateLiveDisasterResponse(location, disasterType){
        const prompt = `an individual claims there is a disaster (${disasterType}) ongoing in ${location} right now. respond strictly with an alert but calming message (informing them about the disaster, telling them precautions to take, and telling them to stay calm) for users in the environment.respond with the message only, no explanation is expected in your response`
        return this.exec(prompt)
    }

    generateEducativeQuote(){
        const topics = ["climate actions", "natural disasters", "carbon footprint", "global warming", "reforestation and deforestation", ]

        const prompt = `generate a tip/quote/message about ${topics[Math.floor(Math.random() * topics.length)]}. note: no prefix or title or suffix is expected, return only the message in your response`
        return this.exec(this.usePrePrompt(prompt))
    }

    getLocationFromPrompt(t){
        const prompt = `from this prompt (${t}) detect the location that is being referenced..respond with the location only, no explanation is expected in your response`
        return this.exec(prompt)
    }

    predictDisasterType(t, imageFile= undefined){
        const prompt = `from this prompt(${t})${imageFile && " and image attached"} detect the disaster type being reported referenced..respond with the disaster type only, no explanation is expected in your response`
        return this.exec(prompt, imageFile)
    }

    predictDisasterOccurence(disasterType, location){
        const prompt = `from this prompt(based on analysis of previous environmental data, Is it possible to experience a/an ${disasterType} by this time of the year in ${location})respond with a true or false..respond with true or false only, no explanation is expected in your response`
        return this.exec(prompt)
    }

    generateTitle(conversation){
        const prompt = `generate a short title for this conversation: "${conversation}".respond with the title only, no explanation is expected in your response`
        return this.exec(prompt)
    }

    getSafetyRecommendations(disasterType, magnitude=undefined, returnHtml=false ){
        const prompt = `generate safety recommendations ${returnHtml && "formatted (and styled properly) in HTML code "}for an occuring disaster (${disasterType}) ${magnitude && `with a severity of ${magnitude} out of 10 `}.${returnHtml && ` Your response must be in html (e.g <div styles="font-size:16px;" >recommendations here</div>)` }respond with the recommendations only, no explanation is expected in your response`
        return this.exec(prompt)
    }



}

const aiService = new AI()

module.exports = Object.freeze(aiService)