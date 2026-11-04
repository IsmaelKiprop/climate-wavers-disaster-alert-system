import math


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two WGS84 points in kilometers."""
    try:
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def nearby_agencies(agencies, lat, lng, radius_km=100, limit=5):
    scored = []
    for agency in agencies:
        dist = haversine_km(lat, lng, agency.latitude, agency.longitude)
        if dist is None:
            continue
        if dist <= float(radius_km):
            scored.append((dist, agency))
    scored.sort(key=lambda item: item[0])
    return scored[:limit]
