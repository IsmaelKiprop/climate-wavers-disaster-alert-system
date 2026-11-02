"""Map ImageNet class indices to Climate Wavers scene labels."""

DISASTER_CLASSES = [
    "Damaged Infrastructure",
    "Drought",
    "Earthquake",
    "Human",
    "Human Damage",
    "Land Slide",
    "Non Damage Buildings and  Street",
    "Non Damage Wildlife Forest",
    "Sea",
    "Urban Fire",
    "Water Disaster",
    "Wild Fire",
]

IMAGENET_TO_DISASTER = {
    442: "Non Damage Buildings and  Street",  # beacon
    449: "Non Damage Buildings and  Street",  # boathouse
    483: "Non Damage Buildings and  Street",  # castle
    497: "Non Damage Buildings and  Street",  # church
    536: "Sea",  # dock
    554: "Water Disaster",  # fireboat
    555: "Urban Fire",  # fire engine
    562: "Water Disaster",  # fountain
    610: "Damaged Infrastructure",  # jeep
    656: "Damaged Infrastructure",  # minivan
    663: "Non Damage Buildings and  Street",  # monastery
    675: "Non Damage Buildings and  Street",  # moving van
    698: "Non Damage Buildings and  Street",  # palace
    717: "Sea",  # pier
    779: "Damaged Infrastructure",  # school bus
    811: "Damaged Infrastructure",  # space shuttle
    820: "Damaged Infrastructure",  # steel arch bridge
    825: "Damaged Infrastructure",  # stone wall
    854: "Non Damage Buildings and  Street",  # thatch
    888: "Damaged Infrastructure",  # viaduct
    913: "Damaged Infrastructure",  # wreck
    937: "Non Damage Wildlife Forest",
    970: "Land Slide",  # alp
    972: "Land Slide",  # cliff
    973: "Water Disaster",  # coral reef
    974: "Water Disaster",  # geyser
    975: "Water Disaster",  # lakeside
    976: "Sea",  # promontory
    978: "Sea",  # seashore
    979: "Earthquake",  # valley
    980: "Wild Fire",  # volcano
    981: "Human",  # ballplayer
    983: "Human",  # scuba diver
    984: "Non Damage Wildlife Forest",
    985: "Non Damage Wildlife Forest",
    346: "Drought",
    351: "Drought",
    352: "Drought",
    353: "Drought",
}


def disaster_from_indices(indices, scores=None):
    votes = {}
    for i, index in enumerate(indices):
        label = IMAGENET_TO_DISASTER.get(int(index))
        if not label:
            continue
        weight = float(scores[i]) if scores is not None else 1.0
        votes[label] = votes.get(label, 0.0) + weight
    if not votes:
        return None
    return max(votes, key=votes.get)
