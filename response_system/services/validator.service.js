const Joi = require("joi")

class Validator{
   validatePost(obj){
    return Joi.object({
        username: Joi.string().required(),
        userId: Joi.string().required(),
        body: Joi.string().required(),
        replyTo: Joi.string(),
        image: Joi.string(),
        location: Joi.string(),
    }).validate(obj)
    } 

    validateAiPayload(obj){
        return Joi.object({
            postId: Joi.string().required(),
            body: Joi.string().required(),
            image: Joi.string()
        }).validate(obj)
    }

    validateGetByIdObj(obj){
        return Joi.object({
            id: Joi.string().required()
        }).validate(obj)
    }
    
    validateChatBody(obj){
        return Joi.object({
            body: Joi.string().required(),
            userId: Joi.string().required(),
        }).validate(obj)
    }

    validateReportPayload(obj){
        return Joi.object({
            body: Joi.string().required(),
            userId: Joi.string().required(),
            image: Joi.string(),
            location: Joi.string().required()
        }).validate(obj)
    }

    validateCreateChatPayLoad(obj){
        return Joi.object({
            userId: Joi.string().required()
        }).validate(obj)
    }

    validateLogObject(obj){
        return Joi.object({
            username: Joi.string(),
            action: Joi.string().required(),
            timestamp: Joi.string(),
            data: Joi.object().unknown(true)
        }).validate(obj)
    }

    validateCreateDisasterPayload(obj){
        return Joi.object({
            startDate: Joi.number().default(Date.now()),
            endDate: Joi.number(),
            totalDeath: Joi.number().default(0),
            injured: Joi.number().default(0),
            homeless: Joi.number().default(0),
            magnitude: Joi.number(),
            magnitudeScale: Joi.string(),
            coordinate: Joi.object({
                lng: Joi.number().required(),
                lat: Joi.number().required()
            }),
            latitude: Joi.number(),
            longitude: Joi.number(),
            lat: Joi.number(),
            lng: Joi.number(),
            disasterType: Joi.string().required(),
            country: Joi.string().required(),
            region: Joi.string().required(),
            severity: Joi.number(),
            images: Joi.array().default([]),
            details: Joi.string().required(),
            status: Joi.string().default("REPORTED")
        }).validate(obj)
    }
}

const validator = new Validator()

module.exports = validator
    