const config = require("../config/config");
const axios = require("axios");
const { isEndpointOk } = require("../utils/factory");

function toIsoDate(value) {
    const date = new Date(value)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const day = String(date.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

class AnalysisModel{
    constructor(baseUrl=config.aiModels.analysis){
        this.baseUrl = baseUrl
    }
    
    async isRunning(){
        const url = this.baseUrl + "/status"
        return await isEndpointOk(url)
    }

    async getInference(coordinate, startDate= Date.now() - (2 * 24 * 60 * 60 * 1000), endDate=Date.now()){
        const url = this.baseUrl + "/inference"
        const res = await axios.post(url, {
            location: coordinate, 
            startDate: toIsoDate(startDate),
            endDate: toIsoDate(endDate)
        }, { timeout: 45000 })
        return res.data
    }
}

module.exports = Object.freeze(new AnalysisModel())