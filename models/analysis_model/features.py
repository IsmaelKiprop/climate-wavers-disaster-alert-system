"""Shared feature layout for training and inference.

Must match fetch_climate_data() column order in prediction.py after
Visual Crossing rows are renamed and humidity stats are appended.
"""

FEATURE_COLUMNS = [
    "Maximum Temperature",
    "Minimum Temperature",
    "Dew Point",
    "Temperature",
    "Wind Speed Min",
    "Wind Speed Max",
    "Wind Speed Mean",
    "Wind Direction",
    "Precipitation",
    "Cloud Cover",
    "Sea Level Pressure",
    "Precipitation Cover",
    "Relative Humidity Min",
    "Relative Humidity Max",
    "Relative Humidity Mean",
]

DISASTER_TYPES = ["Earthquake", "Flood", "Storm"]
