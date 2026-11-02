import { useState } from "react";
import PublicPage from "../components/PublicPage";
import { SITE } from "../config/site";

const ContactUs = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const onChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const subject = encodeURIComponent(form.subject || `Message from ${form.name || "Climate Wavers visitor"}`);
    const body = encodeURIComponent(`${form.message}\n\nFrom: ${form.name} <${form.email}>`);
    window.location.href = `mailto:${SITE.emails.hello}?subject=${subject}&body=${body}`;
  };

  return (
    <PublicPage
      title="Contact"
      description={`Reach ${SITE.name} at ${SITE.emails.hello}.`}
      wide
    >
      <h1 className="text-3xl sm:text-4xl font-semibold">Contact us</h1>
      <p className="mt-3 text-muted max-w-2xl">
        Use these Climate Wavers addresses. There is no public phone number listed for the site.
      </p>

      <div className="mt-8 grid lg:grid-cols-2 gap-10">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium">General</dt>
            <dd><a className="text-primary" href={`mailto:${SITE.emails.hello}`}>{SITE.emails.hello}</a></dd>
          </div>
          <div>
            <dt className="font-medium">Support</dt>
            <dd><a className="text-primary" href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a></dd>
          </div>
          <div>
            <dt className="font-medium">Privacy</dt>
            <dd><a className="text-primary" href={`mailto:${SITE.emails.privacy}`}>{SITE.emails.privacy}</a></dd>
          </div>
        </dl>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            Name
            <input required name="name" value={form.name} onChange={onChange} className="mt-1 w-full h-11 px-3 border border-border bg-surface" />
          </label>
          <label className="block text-sm">
            Email
            <input required type="email" name="email" value={form.email} onChange={onChange} className="mt-1 w-full h-11 px-3 border border-border bg-surface" />
          </label>
          <label className="block text-sm">
            Subject
            <input required name="subject" value={form.subject} onChange={onChange} className="mt-1 w-full h-11 px-3 border border-border bg-surface" />
          </label>
          <label className="block text-sm">
            Message
            <textarea required name="message" value={form.message} onChange={onChange} rows={5} className="mt-1 w-full px-3 py-2 border border-border bg-surface" />
          </label>
          <button type="submit" className="h-11 px-4 bg-primary text-primary-foreground">
            Open email to {SITE.emails.hello}
          </button>
        </form>
      </div>
    </PublicPage>
  );
};

export default ContactUs;
