import nodemailer from "nodemailer"
import config from "../config/config.js"
import ejs from "ejs"
import path from "path"

const __dirname = process.cwd()
const ON_RENDER = Boolean(process.env.RENDER)

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
        resendKey: Boolean(process.env.RESEND_API_KEY),
        onRender: ON_RENDER,
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

function fromAddresses() {
    const configured = process.env.MAIL_FROM || config.mail.auth.user || ""
    const lowered = configured.toLowerCase()
    const addresses = []
    if (
        configured &&
        !lowered.includes("gmail.com") &&
        !lowered.includes("example.com") &&
        !lowered.includes("yahoo.") &&
        !lowered.includes("outlook.") &&
        !lowered.includes("hotmail.")
    ) {
        addresses.push(configured)
    }
    addresses.push("Climate Wavers <hello@flowops.africa>")
    addresses.push("Climate Wavers <onboarding@resend.dev>")
    return [...new Set(addresses)]
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

    async _sendResend(email, html, subject, from) {
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
                from,
                to: [email],
                subject,
                html,
            }),
            signal: AbortSignal.timeout(12000),
        })
        const detail = await response.text()
        if (!response.ok) {
            throw new Error(`resend ${response.status}: ${detail}`)
        }
        return detail
    }

    async diagnose() {
        const report = { ...mailMeta(), probes: [], resend: null }
        if (process.env.RESEND_API_KEY) {
            try {
                const response = await fetch("https://api.resend.com/domains", {
                    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
                    signal: AbortSignal.timeout(10000),
                })
                const data = await response.json()
                report.resend = {
                    ok: response.ok,
                    status: response.status,
                    domains: Array.isArray(data.data)
                        ? data.data.map((domain) => ({ name: domain.name, status: domain.status }))
                        : [],
                }
            } catch (error) {
                report.resend = { ok: false, error: String(error.message || error) }
            }
        }
        const attempts = [
            { port: 465, secure: true },
            { port: Number(process.env.MAIL_PORT) || 587, secure: false, requireTLS: true },
        ]
        for (const attempt of attempts) {
            report.probes.push(await this._tryPort(attempt))
        }
        console.log(`mail diagnose ${JSON.stringify(report)}`)
        return report
    }

    async sendMail(email, html, subject="Climate Wavers"){
        const failures = []
        if (process.env.RESEND_API_KEY) {
            for (const from of fromAddresses()) {
                const started = Date.now()
                try {
                    await this._sendResend(email, html, subject, from)
                    console.log(`mail resend sent ${JSON.stringify({ from, ms: Date.now() - started })}`)
                    return
                } catch (error) {
                    const failure = {
                        via: "resend",
                        from,
                        ms: Date.now() - started,
                        error: describeError(error),
                    }
                    failures.push(failure)
                    console.log(`mail resend failed ${JSON.stringify(failure)}`)
                }
            }
        }
        if (!ON_RENDER) {
            const attempts = [
                { port: 465, secure: true },
                { port: Number(process.env.MAIL_PORT) || 587, secure: false, requireTLS: true },
            ]
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
                    })}`)
                    return
                } catch (error) {
                    const failure = {
                        via: "smtp",
                        port: attempt.port,
                        ms: Date.now() - started,
                        error: describeError(error),
                    }
                    failures.push(failure)
                    console.log(`mail smtp failed ${JSON.stringify({ ...mailMeta(), ...failure })}`)
                }
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
