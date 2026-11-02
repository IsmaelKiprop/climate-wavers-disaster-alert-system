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

function mailMeta() {
    return {
        host: process.env.MAIL_HOST || "smtp.gmail.com",
        userSet: Boolean(process.env.MAIL_USER),
        passSet: Boolean(process.env.MAIL_PASS),
        fromSet: Boolean(process.env.MAIL_FROM || process.env.MAIL_USER),
    }
}

function describeError(error) {
    if (!error) return { message: "unknown error" }
    return {
        message: String(error.message || error),
        code: error.code || null,
        command: error.command || null,
        response: error.response || null,
        responseCode: error.responseCode || null,
        syscall: error.syscall || null,
        errno: error.errno || null,
        address: error.address || null,
        port: error.port || null,
    }
}

class Mailer{
    constructor(){
        this.from_address = process.env.MAIL_FROM || config.mail.auth.user
    }

    loadTemplate(path, data){
        return ejs.renderFile(path, data)
    }

    _transport(options) {
        return nodemailer.createTransport({
            host: process.env.MAIL_HOST || "smtp.gmail.com",
            family: 4,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
            connectionTimeout: 12000,
            greetingTimeout: 12000,
            socketTimeout: 15000,
            tls: { minVersion: "TLSv1.2" },
            ...options,
        })
    }

    async _tryPort(attempt) {
        const started = Date.now()
        const result = {
            port: attempt.port,
            secure: Boolean(attempt.secure),
            ok: false,
            ms: 0,
        }
        try {
            const transporter = this._transport(attempt)
            await transporter.verify()
            result.ok = true
            result.ms = Date.now() - started
            transporter.close()
            console.log(`mail smtp probe ${JSON.stringify({ ...mailMeta(), ...result })}`)
            return result
        } catch (error) {
            result.ms = Date.now() - started
            result.error = describeError(error)
            console.log(`mail smtp probe ${JSON.stringify({ ...mailMeta(), ...result })}`)
            return result
        }
    }

    async diagnose() {
        const attempts = [
            { port: 465, secure: true },
            { port: Number(process.env.MAIL_PORT) || 587, secure: false, requireTLS: true },
        ]
        const probes = []
        for (const attempt of attempts) {
            probes.push(await this._tryPort(attempt))
        }
        return { ...mailMeta(), probes }
    }

    async sendMail(email, html, subject="Climate Wavers"){
        const attempts = [
            { port: 465, secure: true },
            { port: Number(process.env.MAIL_PORT) || 587, secure: false, requireTLS: true },
        ]
        const failures = []
        for (const attempt of attempts) {
            const started = Date.now()
            try {
                const transporter = this._transport(attempt)
                await transporter.sendMail({
                    to: email,
                    from: this.from_address,
                    html,
                    subject,
                })
                transporter.close()
                console.log(`mail smtp sent ${JSON.stringify({
                    ...mailMeta(),
                    port: attempt.port,
                    ms: Date.now() - started,
                    toHost: String(email).split("@")[1] || "",
                })}`)
                return
            } catch (error) {
                const failure = {
                    port: attempt.port,
                    secure: Boolean(attempt.secure),
                    ms: Date.now() - started,
                    error: describeError(error),
                }
                failures.push(failure)
                console.log(`mail smtp failed ${JSON.stringify({ ...mailMeta(), ...failure })}`)
            }
        }
        const err = new Error("mail send failed")
        err.smtp = { ...mailMeta(), failures }
        throw err
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
