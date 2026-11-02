import Joi from "joi"

class MailValidation{
    validateForgetPasswordEmailData(data){
        return Joi.object({
            url: Joi.string()
        }).validate(data)
    }
    validateDisasterAlertEmailData(data){
        return Joi.object({
            city: Joi.string().required(),
            disasterType: Joi.string().required(),
            country: Joi.string().allow("", null),
            details: Joi.string().allow("", null),
            id: Joi.string().allow("", null),
            vision: Joi.string().allow("", null),
            email: Joi.string().email(),
            emails: Joi.array().items(Joi.string().email()),
        }).unknown(true).validate(data)
    }
    validateCustomEmailData(data){
        return Joi.object({
            content: Joi.string().required()
        }).validate(data)
    }
    validateVerificationEmailData(data){
        return Joi.object({
            code: Joi.string().required(),
            city: Joi.string()
        }).validate(data)
    }
}

const mailDataValidator =  new MailValidation()

export default Object.freeze(mailDataValidator)