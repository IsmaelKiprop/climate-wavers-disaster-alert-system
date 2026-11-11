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

/** Tree Admin monetization — supporters pay for trees; 18% platform fee. */
export const TREE_PLATFORM_FEE_NOTE =
  "Supporters pay for trees. Climate Wavers keeps an 18% platform fee; 82% goes to the Tree Admin project.";

export const TREE_ADMIN_PLANS = [
  {
    key: "pilot",
    name: "Tree Admin Pilot",
    price: "Free for 90 days",
    detail: "Verified nurseries, CBOs, schools, and faith groups start free after approval.",
    points: [
      "Create planting projects",
      "Upload photo proof",
      "Up to 2 active projects",
      "Receive funded trees from supporters",
    ],
    cta: { to: "/tree-admins/apply?plan=pilot", label: "Start free pilot" },
    featured: true,
  },
  {
    key: "growth",
    name: "Tree Admin Growth",
    price: "KES 3,000 / mo",
    detail: "For orgs running multiple sites after the pilot.",
    points: [
      "Everything in Pilot",
      "Up to 5 active projects",
      "Featured listing priority",
      "Best for multi-site CBOs",
    ],
    cta: { to: "/tree-admins/apply?plan=growth", label: "Apply for Growth" },
    featured: false,
  },
  {
    key: "partner",
    name: "Tree Admin Partner",
    price: "Custom",
    detail: "Multi-town ops, payout priority, and FlowOps support.",
    points: [
      "Unlimited active projects",
      "Payout priority (manual ops)",
      "Training & onboarding",
      "Priority support from FlowOps Africa",
    ],
    cta: { to: "/consulting", label: "Talk to FlowOps" },
    featured: false,
  },
];

export const TREE_ADMIN_PLAN_OPTIONS = [
  { value: "pilot", label: "Pilot — free 90 days after approval" },
  { value: "growth", label: "Growth — KES 3,000 / mo (after pilot)" },
  { value: "partner", label: "Partner — custom (talk to FlowOps)" },
];
