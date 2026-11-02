const GENERIC = [
  "Move away from immediate danger and help others only if you can do so without putting yourself at risk.",
  "Follow instructions from official emergency services. Do not ignore evacuation orders.",
  "Use a flashlight or battery lamp. Avoid candles and open flames if gas or electrical lines may be damaged.",
  "Stay away from downed power lines and flooded or damaged electrical equipment.",
  "Drink bottled, boiled, or treated water. Do not eat food that has been in floodwater or smoke.",
  "Seek medical care for injuries now. Do not wait.",
  "Use official sources for updates. Treat social media posts as unconfirmed until they are verified.",
  "Check on neighbours if it is safe, especially children, older people, and people with disabilities.",
];

const BY_TYPE = {
  flood: [
    "Move to higher ground immediately if water is rising or officials tell you to evacuate.",
    "Never walk, swim, or drive through floodwater. Turn around, do not drown.",
    "Obey evacuation orders from NDMA, Kenya Red Cross, police, or county officials.",
    "Use a flashlight or battery lamp. Do not use candles or open flames around wet wiring or gas.",
    "Stay away from downed power lines and electrical equipment that has been in water.",
    "Do not eat food that touched floodwater. Drink bottled, boiled, or treated water only.",
    "Do not collect floodwater for drinking, cooking, or storage.",
    "Seek medical care for injuries now. Do not wait for waters to recede.",
    "Use official alerts from NDMA, Kenya Red Cross, or your county government. Treat social posts as unconfirmed.",
    "After the water drops, wear boots and gloves, watch for debris and open manholes, and disinfect surfaces.",
  ],
  earthquake: [
    "If you are indoors, drop, cover, and hold on. Stay away from windows and exterior walls.",
    "If you are outdoors, move to an open area away from buildings, power lines, and trees.",
    "Do not use elevators. After shaking stops, evacuate if the building is damaged.",
    "Expect aftershocks. Move carefully and watch for falling debris.",
    "Check for gas leaks and damaged wiring before using lights, stoves, or candles.",
    "Use official updates from disaster agencies. Call emergency services only for life-threatening needs.",
  ],
  wildfire: [
    "Leave early if officials issue an evacuation order. Do not wait to see the fire.",
    "Wear a mask or cloth over your nose and mouth to reduce smoke if you must go outside.",
    "Close windows and doors. Turn off ventilation that pulls in outdoor air.",
    "Do not return until officials say it is safe.",
    "If you are trapped, call emergency services, stay low, and move to a cleared area if you can.",
  ],
  storm: [
    "Stay indoors away from windows. Unplug appliances if lightning is close.",
    "Do not drive through flooded roads or underpasses.",
    "Secure loose outdoor items before the storm if you still have time.",
    "If a roof or wall fails, move to an interior room on the lowest safe floor.",
    "After the storm, watch for downed lines and damaged trees. Use official all-clear notices.",
  ],
  drought: [
    "Follow local water-use restrictions.",
    "Store drinking water in clean, covered containers. Do not use untreated surface water.",
    "Watch for heat illness: dizziness, confusion, or no sweating in high heat are emergencies.",
    "Check on neighbours who may lack water or cooling.",
  ],
  landslide: [
    "Leave the area immediately if you hear rumbling, see tilting trees, or notice sudden water in unusual places.",
    "Do not cross a moving slope or debris flow.",
    "Move upslope or to stable ground, not into valleys or stream channels.",
    "Stay away until officials inspect the slope.",
  ],
};

export function normalizeHazardType(disasterType = "") {
  const key = String(disasterType).toLowerCase();
  if (key.includes("flood")) return "flood";
  if (key.includes("quake")) return "earthquake";
  if (key.includes("fire") || key.includes("wildfire")) return "wildfire";
  if (key.includes("storm") || key.includes("hurricane") || key.includes("typhoon") || key.includes("cyclone")) {
    return "storm";
  }
  if (key.includes("drought") || key.includes("heat")) return "drought";
  if (key.includes("landslide") || key.includes("mudslide")) return "landslide";
  return "generic";
}

export function safetyStepsFor(disasterType) {
  return BY_TYPE[normalizeHazardType(disasterType)] || GENERIC;
}
