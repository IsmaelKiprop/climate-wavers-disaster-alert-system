/** Shared RapidBrief pricing copy — keep in sync with backend core/pricing.py */

export const COMMUNITY_TIER = {
  name: "Community",
  price: "Free",
  detail: "For people who need nearby disaster alerts.",
  points: [
    "Email + WhatsApp alerts (verified phone)",
    "Live USGS + NASA map",
    "Community reports & posts",
    "Plant / gift a tree",
  ],
  cta: { to: "/signup", label: "Create free account" },
};

export const RAPIDBRIEF_PLANS = [
  {
    key: "pilot",
    name: "RapidBrief Pilot",
    price: "Free for 90 days",
    detail: "Verified humanitarian orgs start with a free pilot after admin approval.",
    points: [
      "AI RapidBrief dispatch inbox",
      "WhatsApp + email org alerts",
      "Up to 5 seats",
      "Coverage radius & disaster types",
    ],
    cta: { to: "/responders/apply?plan=pilot", label: "Start free pilot" },
    featured: false,
  },
  {
    key: "ngo",
    name: "RapidBrief NGO",
    price: "KES 5,000 / mo",
    detail: "Built for small–mid NGOs and community response teams.",
    points: [
      "Everything in Pilot",
      "Up to 8 seats",
      "Priority for NGO verification",
      "Affordable field-team pricing",
    ],
    cta: { to: "/responders/apply?plan=ngo", label: "Apply as NGO" },
    featured: true,
  },
  {
    key: "org",
    name: "RapidBrief Org",
    price: "KES 15,000 / mo",
    detail: "Counties, national NGOs, and multi-seat desks.",
    points: [
      "Everything in NGO",
      "Up to 25 seats",
      "Larger coverage operations",
      "Best for county / national teams",
    ],
    cta: { to: "/responders/apply?plan=org", label: "Apply as org" },
    featured: false,
  },
  {
    key: "partner",
    name: "FlowOps Partner",
    price: "Custom",
    detail: "WhatsApp/AI setup, training, and priority support.",
    points: [
      "WhatsApp Business / AI receptionist",
      "Custom alert workflows",
      "Training & onboarding",
      "Priority support from FlowOps Africa",
    ],
    cta: { to: "/consulting", label: "Talk to FlowOps" },
    featured: false,
  },
];

export const PLAN_OPTIONS = [
  { value: "pilot", label: "Pilot — free 90 days after approval" },
  { value: "ngo", label: "NGO — KES 5,000 / mo (after pilot)" },
  { value: "org", label: "Org — KES 15,000 / mo (after pilot)" },
  { value: "partner", label: "Partner — custom (talk to FlowOps)" },
];
