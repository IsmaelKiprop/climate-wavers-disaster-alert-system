import mailDataValidator from "../validation/mail.js"
import mailer from "./mailer.js"
import Subscription from "./subscription.js"

class Controller{

    async sendDisasterAlert(d){
        const data = d?.data || d
        if(!data)return
        const validationErr = mailDataValidator.validateDisasterAlertEmailData(data)?.error
        if(validationErr){
            console.log(validationErr)
            return
        }
        const city = String(data.city || "").toLowerCase()
        let dataList = []
        if (city) {
            try {
                dataList = await Subscription.find({city})
            } catch (error) {
                console.log(`subscription lookup failed: ${error}`)
            }
        }
        const extra = [].concat(data.emails || [], data.email ? [data.email] : [])
        extra.forEach((email) => {
            if (email && !dataList.some((row) => row.email === email)) {
                dataList.push({ email })
            }
        })
        if (!dataList.length) return
        const mailData = {city: data.city, type: data.disasterType}
        await Promise.all(dataList.map((row) => mailer.sendDisasterAlert(row.email, mailData, `${data.disasterType} Alert`)))
    }

    async sendCustom(d){
        const {  emails, email, data} = d
        if(!emails && !email)return
        if(!data)return
        const validationErr = mailDataValidator.validateCustomEmailData(data).error
        if(validationErr){
            console.log(validationErr)
            return
        }
        if(email){
            try {
                await mailer.sendCustom(email, data)
            } catch (error) {
                console.log(error)
            }
        }
        if(emails){
            for(let email of emails){
                try{
                    await mailer.sendCustom(email, data)
                }catch(ex){
                    console.log(ex)
                    continue;
                }
    
            }
        }
    }

    sendForgetPassword(d){
        const { email, data } = d
        if(!email)return 
        if(!data)return
        const validationErr = mailDataValidator.validateForgetPasswordEmailData(data).error
        if(validationErr){
            console.log(validationErr)
            return
        }
        try {
            mailer.sendForgetPassword(email, data)
        } catch (error) {
            console.log(`mail error: ${error}`)
        }

    }

    async sendVerification(d){
        const {email, data} = d
        if(!email || !data)return
        const validationErr = mailDataValidator.validateVerificationEmailData(data).error
        if(validationErr){
            console.log(validationErr)
            return
        }
        
        await mailer.sendVerification(email, data)
        const {city} = data
        try {
            const sub = new Subscription(email, city)
            await sub.exec()
        } catch (error) {
            console.log(`subscription store failed: ${error}`)
        }
    }

    async onboardUser(d){
        const {email, city}= d
        const sub = new Subscription(email, city)
        await sub.exec()
        await mailer.sendOnboarding(email)
    }

    
}

export default Object.freeze(new Controller())