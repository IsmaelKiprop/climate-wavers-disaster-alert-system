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
            content: Joi.string().required(),
            subject: Joi.string().allow("", null),
            headline: Joi.string().allow("", null),
            name: Joi.string().allow("", null),
            first_name: Joi.string().allow("", null),
            cta_text: Joi.string().allow("", null),
            cta_url: Joi.string().allow("", null),
            link: Joi.string().allow("", null),
            hero_image: Joi.string().allow("", null),
            reply_hint: Joi.string().allow("", null),
            preheader: Joi.string().allow("", null),
            date: Joi.string().allow("", null),
            time: Joi.string().allow("", null),
        }).unknown(true).validate(data)
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