import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";

const OUTCOMES = [
  ["outage_resilience", "Outage resilience"], ["trees_charcoal", "Trees and charcoal"],
  ["drought_resilience", "Drought resilience"], ["plastic_recovery", "Plastic recovery"],
];
const CATEGORIES = [["solar", "Solar kits / lighting"], ["cookstove", "Clean cookstoves"], ["water", "Water"], ["waste", "Waste"]];
const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

export function EcoPulse() {
  const location = useLocation();
  const embedded = location.pathname.startsWith("/app/");
  const [params] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [county, setCounty] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [challengeOptions, setChallengeOptions] = useState({ groups: [], challenges: [] });
  const [chapterId, setChapterId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (county) query.set("county", county);
      if (outcome) query.set("outcome", outcome);
      const data = await client.run("get", `${endpoints.ecoProducts}?${query}` , null, false, false, false, false);
      setProducts(data?.results || []);
    } catch { setProducts([]); }
  }, [county, outcome]);
  useEffect(() => { load(); }, [load]);
  const loadOrders = useCallback(() => {
    if (!getAuthToken()) { setMyOrders([]); return Promise.resolve([]); }
    return client.run("get", endpoints.ecoMyOrders, null, true).then(setMyOrders).catch(() => setMyOrders([]));
  }, []);
  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => {
    if (!getAuthToken()) return;
    client.run("get", endpoints.ecoChallenges, null, true).then(setChallengeOptions).catch(() => {});
  }, []);
  useEffect(() => {
    const reference = params.get("reference");
    const orderId = params.get("eco_order");
    if (!reference || !orderId) return;
    client.run("post", endpoints.verifyPayment, { reference, product: "eco_pulse", eco_order_id: orderId }, true)
      .then(() => toast.success("Payment received. The vendor will coordinate installation."))
      .catch(() => toast.error("Payment is processing. Your order will update when Paystack confirms it."));
  }, [params]);

  const order = async (product) => {
    if (busy) return;
    const buyerCounty = county.trim();
    if (!buyerCounty) { toast.info("Enter your county in the area filter before ordering."); return; }
    setBusy(true);
    try {
      const payload = { product_id: product.id, quantity, county: buyerCounty };
      if (chapterId || challengeId) { payload.chapter_id = chapterId; payload.challenge_id = challengeId; }
      const created = await client.run("post", endpoints.ecoOrders, payload, true);
      if (created.status === "lead") { toast.info(created.message); return; }
      const checkout = await client.run("post", endpoints.ecoCheckout, { order_id: created.id }, true);
      if (checkout.authorization_url) window.location.assign(checkout.authorization_url);
      else toast.success(created.message);
    } catch (err) {
      if (err?.response?.status === 401) window.location.assign(`/login?redirect=${encodeURIComponent("/eco-pulse")}`);
      else toast.error(err?.response?.data?.detail || "Could not start this order.");
    }
    finally { setBusy(false); }
  };

  const checkIn = async (orderId, day, working) => {
    const submit = async (position) => {
      try {
        await client.run("post", endpoints.ecoCheckIn(orderId), {
          day_mark: day, working,
          latitude: position?.coords?.latitude,
          longitude: position?.coords?.longitude,
        }, true);
        toast.success("Thanks for checking in. Your update contributes to the community impact map.");
        loadOrders();
      } catch (err) { toast.error(err?.response?.data?.detail || "Check-in is not due yet."); }
    };
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(submit, () => submit(null), { timeout: 5000 });
    else submit(null);
  };
  const endorse = async (vendorId) => {
    try {
      const result = await client.run("post", endpoints.ecoEndorse(vendorId), {}, true);
      toast.success(result.community_trusted ? "Vendor now has the Community trusted stamp." : "Your community trust stamp was added.");
      load();
    } catch (err) {
      if (err?.response?.status === 401) window.location.assign(`/login?redirect=${encodeURIComponent("/eco-pulse")}`);
      else toast.error(err?.response?.data?.detail || "Only verified local champions and CBO/tree admins can endorse.");
    }
  };

  return <PublicPage title="Eco Pulse" description="Verified local resilience products for your ward." wide embedded={embedded}>
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Climate Wavers marketplace</p>
          <h1 className="mt-2 text-3xl font-bold">Resilience for your ward</h1>
          <p className="mt-2 max-w-2xl text-muted">Buy from verified local vendors. Purchases support measurable outcomes in the communities covered.</p></div>
        <div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center justify-center bg-primary px-5 font-semibold text-primary-foreground" to="/eco-pulse/apply">Become a vendor</Link><Link className="inline-flex min-h-11 items-center justify-center rounded border border-border px-4 font-medium" to="/app/eco-pulse/desk">Vendor desk</Link></div>
      </div>
      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="text-sm">County or ward<input className="mt-1 h-11 w-full rounded border border-border bg-background px-3" placeholder="e.g. Kisumu" value={county} onChange={(e) => setCounty(e.target.value)} /></label>
        <label className="text-sm">Community outcome<select className="mt-1 h-11 w-full rounded border border-border bg-background px-3" value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">All outcomes</option>{OUTCOMES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm">Bulk quantity<input className="mt-1 h-11 w-full rounded border border-border bg-background px-3" type="number" min="1" max="1000" value={quantity} onChange={(e)=>setQuantity(Math.max(1,Math.min(1000,Number(e.target.value)||1)))} /></label>
        {challengeOptions.groups.length>0&&<label className="text-sm">Buy for chapter<select className="mt-1 h-11 w-full rounded border border-border bg-background px-3" value={chapterId} onChange={(e)=>setChapterId(e.target.value)}><option value="">Personal order</option>{challengeOptions.groups.map(g=><option key={g.id} value={g.id}>{g.name} · {g.county}</option>)}</select></label>}
        {chapterId&&<label className="text-sm">Challenge<select className="mt-1 h-11 w-full rounded border border-border bg-background px-3" value={challengeId} onChange={(e)=>setChallengeId(e.target.value)}><option value="">Choose active challenge</option>{challengeOptions.challenges.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
      </div>
      {products.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((p) => <article key={p.id} className="overflow-hidden rounded-xl border border-border bg-surface">
        {p.photos?.[0] ? <img className="h-44 w-full object-cover" src={p.photos[0]} alt="" /> : <div className="flex h-36 items-center justify-center bg-surface-muted text-4xl">♻</div>}
        <div className="p-4"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{p.title}</h2>{p.vendor.community_trusted && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Community trusted · {p.vendor.trust_count}</span>}</div>
          <p className="mt-1 text-sm text-muted">{p.vendor.name} · {p.vendor.county}</p><p className="mt-3 text-sm">{OUTCOMES.find(([v]) => v === p.outcome_tag)?.[1]} · {p.install_included ? "Installation included" : "Installation not included"}</p>
          <p className="mt-3 text-xl font-bold">{money(p.price_kes)}</p><p className="text-xs text-muted">Warranty: {Math.round((p.warranty_days || 0) / 30)} months · Coverage: {(p.coverage_wards || []).join(", ") || p.vendor.county}</p>
          {!p.vendor.community_trusted && <button onClick={()=>endorse(p.vendor.id)} className="mt-3 min-h-9 rounded border border-border px-3 text-sm">Add a local trust stamp</button>}
          <button disabled={busy} onClick={() => order(p)} className="mt-4 min-h-11 w-full rounded bg-primary font-semibold text-primary-foreground disabled:opacity-60">Order / request coverage</button></div></article>)}</div>
        : <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center"><h2 className="font-semibold">No verified listings in this area yet</h2><p className="mt-2 text-sm text-muted">Local vendors can apply to serve their county.</p></div>}
      {myOrders.some((o) => ["installed","checked_in"].includes(o.status)) && <section className="mt-8 rounded-xl border border-border bg-surface p-4"><h2 className="text-xl font-semibold">Installation check-ins</h2><p className="mt-1 text-sm text-muted">Check whether an installed product is still working. Location is optional.</p>{myOrders.filter((o)=>["installed","checked_in"].includes(o.status)).map((o)=><div key={o.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span>{o.product} · {o.vendor}</span><div className="flex flex-wrap gap-2">{[30,90].filter((d)=>!o.checkins.some((c)=>c.day_mark===d)).map((d)=><span key={d} className="flex gap-1"><button onClick={()=>checkIn(o.id,d,true)} className="rounded border border-border px-3 py-2 text-sm">{d}d · Working</button><button onClick={()=>checkIn(o.id,d,false)} className="rounded border border-border px-3 py-2 text-sm">Needs repair</button></span>)}</div></div>)}</section>}
      <p className="mt-8 text-sm text-muted">After installation, buyers can confirm the product is still working at 30 and 90 days. Confirmed installations appear on the <Link className="text-primary underline" to="/impact-map">Impact Map</Link>.</p>
    </div>
  </PublicPage>;
}

export function EcoPulseApply() {
  const [form,setForm]=useState({name:"",org_type:"cbo",county:"",city:"",contact_phone:"",coverage_wards:""});
  const [busy,setBusy]=useState(false);
  const submit=async(e)=>{e.preventDefault();setBusy(true);try{const data=await client.run("post",endpoints.ecoApply,{...form,coverage_wards:form.coverage_wards.split(",").map(x=>x.trim()).filter(Boolean)},true);toast.success(data.message); }catch(err){if(err?.response?.status===401)window.location.assign(`/login?redirect=${encodeURIComponent("/eco-pulse/apply")}`);else toast.error(err?.response?.data?.detail||"Could not submit the application.");}finally{setBusy(false);}};
  return <PublicPage title="Apply to sell on Eco Pulse" description="Apply to become a verified local resilience vendor." wide><form onSubmit={submit} className="mx-auto my-8 max-w-2xl space-y-4 rounded-xl border border-border bg-surface p-5">
    <h1 className="text-2xl font-bold">Become a verified Eco Pulse vendor</h1><p className="text-sm text-muted">Applications are reviewed by Climate Wavers before listings can go live.</p>
    {[ ["name","Organization name"], ["county","Coverage county"], ["city","City / town"], ["coverage_wards","Wards served (comma separated)"], ["contact_phone","Contact phone"] ].map(([k,label])=><label key={k} className="block text-sm">{label}<input required={k==="name"||k==="county"} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 h-11 w-full rounded border border-border bg-background px-3" /></label>)}
    <label className="block text-sm">Organization type<select value={form.org_type} onChange={e=>setForm({...form,org_type:e.target.value})} className="mt-1 h-11 w-full rounded border border-border bg-background px-3">{["cbo","ngo","school","county","church","other"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <button disabled={busy} className="min-h-11 w-full bg-primary font-semibold text-primary-foreground">{busy?"Submitting…":"Submit vendor application"}</button>
  </form></PublicPage>;
}

export function EcoPulseDesk() {
  const location = useLocation();
  const embedded = location.pathname.startsWith("/app/");
  const [desk,setDesk]=useState(null); const [busy,setBusy]=useState(false);
  const load=useCallback(()=>client.run("get",endpoints.ecoDesk,null,true).then(setDesk).catch(()=>setDesk(null)),[]);
  useEffect(()=>{load();},[load]);
  const add=async(e)=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const data=Object.fromEntries(f.entries());data.price_kes=Number(data.price_kes);data.warranty_days=Number(data.warranty_days);data.install_included=f.get("install_included")==="on";data.coverage_wards=data.coverage_wards.split(",").map(x=>x.trim()).filter(Boolean);setBusy(true);try{await client.run("post",endpoints.ecoDesk,data,true);form.reset();load();toast.success("Listing saved.");}catch(err){toast.error(err?.response?.data?.detail||"Could not save listing.");}finally{setBusy(false);}};
  const savePayout=async(e)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{await client.run("patch",endpoints.ecoDesk,data,true);toast.success("Payout details saved. Climate Wavers must enable payouts before transfers start.");load();}catch(err){toast.error(err?.response?.data?.detail||"Could not save payout details.");}};
  const advance=async(orderId,state)=>{try{await client.run("patch",endpoints.ecoOrders,{order_id:orderId,status:state},true);load();}catch(err){toast.error(err?.response?.data?.detail||"Could not update order.");}};
  if(!desk)return <PublicPage title="Eco Pulse vendor desk" description="Manage Eco Pulse listings and orders." wide embedded={embedded}><div className="mx-auto my-10 max-w-2xl rounded-xl border border-border p-6"><p>Vendor desk access requires an approved application.</p><Link className="mt-3 inline-block text-primary underline" to="/eco-pulse/apply">Apply to become a vendor</Link></div></PublicPage>;
  return <PublicPage title="Eco Pulse vendor desk" description="Manage Eco Pulse listings and orders." wide embedded={embedded}><div className="mx-auto max-w-5xl space-y-6 p-5"><h1 className="text-3xl font-bold">{desk.vendor.name} · Vendor desk</h1><p>Verification: {desk.vendor.verification_status} · Platform fee: {(Number(desk.vendor.platform_fee_rate)*100).toFixed(0)}%</p>
    {desk.vendor.verification_status==="approved"&&<form onSubmit={add} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"><h2 className="text-xl font-semibold sm:col-span-2">Add a listing</h2><input name="title" placeholder="Product title" required className="h-11 rounded border bg-background px-3"/><input name="price_kes" type="number" min="1" placeholder="Price (KES)" required className="h-11 rounded border bg-background px-3"/><select name="category" className="h-11 rounded border bg-background px-3">{CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select name="outcome_tag" className="h-11 rounded border bg-background px-3">{OUTCOMES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input name="warranty_days" type="number" min="0" placeholder="Warranty days" className="h-11 rounded border bg-background px-3"/><input name="coverage_wards" placeholder="Coverage wards / counties" className="h-11 rounded border bg-background px-3"/><input name="photos" placeholder="Photo URL (optional)" className="h-11 rounded border bg-background px-3"/><label className="flex items-center gap-2"><input type="checkbox" name="install_included"/>Installation included</label><button disabled={busy} className="min-h-11 bg-primary text-primary-foreground">{busy?"Saving…":"Save listing"}</button></form>}
    <form onSubmit={savePayout} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"><h2 className="text-xl font-semibold sm:col-span-2">M-Pesa payout details</h2><input name="payout_channel" type="hidden" value="mobile_money"/><input name="payout_account_name" defaultValue={desk.vendor.payout_account_name} placeholder="Account name" className="h-11 rounded border bg-background px-3"/><input name="payout_account_number" defaultValue={desk.vendor.payout_account_number} placeholder="M-Pesa number (07… or 01…)" className="h-11 rounded border bg-background px-3"/><button className="min-h-11 bg-primary text-primary-foreground">Save payout details</button><p className="text-xs text-muted">Payouts {desk.vendor.payouts_enabled?"enabled":"awaiting platform setup"}; current sales split: 15% platform fee by default.</p></form>
    <section><h2 className="mb-3 text-xl font-semibold">Orders and quote requests</h2>{desk.orders.length?desk.orders.map(o=><div key={o.id} className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"><span>{o.product__title} · {o.buyer_county} · Qty {o.quantity} · {money(o.amount_kes)} · {o.status}{o.status==="lead"&&o.buyer__email?` · Contact ${o.buyer__email}`:""}</span>{o.status==="paid"&&<button onClick={()=>advance(o.id,"install_scheduled")} className="rounded border border-border px-3 py-2">Schedule installation</button>}{o.status==="install_scheduled"&&<button onClick={()=>advance(o.id,"installed")} className="rounded border border-border px-3 py-2">Mark installed</button>}</div>):<p className="text-muted">No orders yet.</p>}</section>
  </div></PublicPage>;
}

export function EcoPulseAdmin() {
  const [data,setData]=useState({vendors:[],products:[],orders:[]});
  const [feeValues,setFeeValues]=useState({});
  const load=useCallback(()=>client.run("get",endpoints.ecoAdmin,null,true).then(setData).catch(()=>toast.error("Could not load Eco Pulse admin queue.")),[]);
  useEffect(()=>{load();},[load]);
  const review=async(id,state)=>{try{await client.run("post",endpoints.ecoAdminModerate(id),{verification_status:state},true);toast.success(`Vendor ${state}.`);load();}catch(err){toast.error(err?.response?.data?.detail||"Could not update vendor.");}};
  const enablePayout=async(v)=>{try{await client.run("post",endpoints.ecoAdminModerate(v.id),{payouts_enabled:!v.payouts_enabled},true);load();}catch(err){toast.error(err?.response?.data?.detail||"Could not update payout setup.");}};
  const saveFee=async(v)=>{try{await client.run("post",endpoints.ecoAdminModerate(v.id),{platform_fee_rate:Number(feeValues[v.id]??Number(v.platform_fee_rate)*100)/100},true);toast.success("Vendor commission updated.");load();}catch(err){toast.error(err?.response?.data?.detail||"Could not update commission.");}};
  return <main className="mx-auto max-w-6xl space-y-6 p-5"><h1 className="text-3xl font-bold">Eco Pulse moderation</h1><section><h2 className="mb-3 text-xl font-semibold">Vendor applications</h2>{data.vendors.map(v=><div key={v.id} className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"><div><strong>{v.name}</strong><span className="ml-2 text-sm text-muted">{v.county} · {v.verification_status} · payouts {v.payouts_enabled?"on":"off"}</span></div><div className="flex flex-wrap items-center gap-2">{v.verification_status==="pending"&&<><button onClick={()=>review(v.id,"approved")} className="rounded bg-primary px-3 py-2 text-primary-foreground">Approve</button><button onClick={()=>review(v.id,"rejected")} className="rounded border border-border px-3 py-2">Reject</button></>}{v.verification_status==="approved"&&<><label className="text-sm">Fee %<input aria-label={`Fee percentage for ${v.name}`} type="number" min="0" max="50" step="0.5" value={feeValues[v.id]??Number(v.platform_fee_rate)*100} onChange={e=>setFeeValues({...feeValues,[v.id]:e.target.value})} className="ml-2 h-9 w-20 rounded border border-border bg-background px-2"/></label><button onClick={()=>saveFee(v)} className="rounded border border-border px-3 py-2">Save fee</button><button onClick={()=>enablePayout(v)} className="rounded border border-border px-3 py-2">{v.payouts_enabled?"Disable payouts":"Enable payouts"}</button></>}</div></div>)}</section><section><h2 className="mb-3 text-xl font-semibold">Listings</h2>{data.products.map(p=><div key={p.id} className="mb-2 rounded border border-border p-3">{p.title} · {p.vendor__name} · {p.is_published?"Published":"Unpublished"}</div>)}</section><section><h2 className="mb-3 text-xl font-semibold">Orders</h2>{data.orders.map(o=><div key={o.id} className="mb-2 rounded border border-border p-3">{o.product__title} · {o.vendor__name} · {money(o.amount_kes)} · {o.status}</div>)}</section></main>;
}
