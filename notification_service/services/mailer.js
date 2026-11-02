import nodemailer from "nodemailer"
import config from "../config/config.js"
import ejs from "ejs"
import path from "path"

const __dirname = process.cwd()


export const mailTypes = {
    custom: "custom",
    disaster_alert: "disaster_alert",
    forget_password: "forget_password",
    newsletter: "newsletter",
    onboarding: "onboarding",
    verification: "verification",
}

const getPath = fileName =>{
    return path.join(__dirname, `/templates/${fileName}.ejs`)
}

class Mailer{
    constructor(){
        this.from_address = process.env.MAIL_FROM || config.mail.auth.user
    }

    loadTemplate(path, data){
        return ejs.renderFile(path, data)
    }

    _transport(port, secure) {
        return nodemailer.createTransport({
            host: process.env.MAIL_HOST || "smtp.gmail.com",
            port,
            secure,
            family: 4,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 12000,
            tls: { minVersion: "TLSv1.2" },
        })
    }

    async _sendResend(email, html, subject) {
        const key = process.env.RESEND_API_KEY
        if (!key) {
            throw new Error("RESEND_API_KEY is not set")
        }
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: this.from_address,
                to: [email],
                subject,
                html,
            }),
            signal: AbortSignal.timeout(12000),
        })
        if (!response.ok) {
            const detail = await response.text()
            throw new Error(`resend ${response.status}: ${detail}`)
        }
    }

    async sendMail(email, html, subject="Climate Wavers"){
        try {
            await this._sendResend(email, html, subject)
            return
        } catch (error) {
            console.log(`mail resend skipped or failed: ${error}`)
        }
        const attempts = [
            { port: 465, secure: true },
            { port: Number(process.env.MAIL_PORT) || 587, secure: false },
        ]
        let lastError
        for (const attempt of attempts) {
            try {
                const transporter = this._transport(attempt.port, attempt.secure)
                await transporter.sendMail({
                    to: email,
                    from: this.from_address,
                    html,
                    subject,
                })
                transporter.close()
                return
            } catch (error) {
                lastError = error
                console.log(`mail smtp ${attempt.port} failed: ${error}`)
            }
        }
        throw lastError || new Error("mail send failed")
    }

    async sendCustom(email, data){
        return this.sendMail(email,await this.loadTemplate(getPath(mailTypes.custom), data))
    }

    async sendDisasterAlert(email, data, subject="Disaster Alert"){
        return this.sendMail(email,await this.loadTemplate(getPath(mailTypes.disaster_alert), data), subject)
    }

    async sendForgetPassword(email, data){
        return this.sendMail(email,await this.loadTemplate(getPath(mailTypes.forget_password), data), "Forget Password")
    }

    async sendOnboarding(email){
        return this.sendMail(email,await this.loadTemplate(getPath(mailTypes.onboarding), {}), "Welcome Aboard")
    }

    async sendVerification(email, data){
        return this.sendMail(email, await this.loadTemplate(getPath(mailTypes.verification), data), "Email Verification")
    }

}

export default Object.freeze(new Mailer())