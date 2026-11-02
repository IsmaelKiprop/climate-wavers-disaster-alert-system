import os
from io import StringIO

import joblib
import numpy as np
import pandas as pd
import requests

from analysis_model.features import DISASTER_TYPES, FEATURE_COLUMNS

earthquake_model = None
flood_model = None
storm_model = None
_MODELS = {}


def _model_path(disaster_type):
    return os.path.join("analysis_model", "model", f"{disaster_type}.pkl")


def _load_models():
    global earthquake_model, flood_model, storm_model, _MODELS
    if _MODELS:
        return _MODELS
    missing = [path for path in (_model_path(name) for name in DISASTER_TYPES) if not os.path.exists(path)]
    if missing:
        raise FileNotFoundError(f"Analysis weights are missing: {', '.join(missing)}")
    _MODELS = {name: joblib.load(_model_path(name)) for name in DISASTER_TYPES}
    earthquake_model = _MODELS["Earthquake"]
    flood_model = _MODELS["Flood"]
    storm_model = _MODELS["Storm"]
    return _MODELS


def analysis_ready():
    return all(os.path.exists(_model_path(name)) for name in DISASTER_TYPES)


def fetch_climate_data(location, start_date, end_date, api_key):
    """Fetch climate data at the specified time to run inference."""
    api_url = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"
    if not api_key:
        api_key = os.getenv("API_KEY")
    if not api_key:
        raise RuntimeError("API_KEY is not set; Visual Crossing weather lookup is unavailable")

    params = {
        "location": location,
        "startTime": f"{start_date}T00:00:00Z",
        "endTime": f"{end_date}T23:59:59Z",
        "key": api_key,
        "include": "days",
        "contentType": "csv",
        "elements": "tempmax,tempmin,dew,temp,windspeedmin,windspeedmax,windspeedmean,winddir,humidity,conditions,precip,cloudcover,pressure,precipcover",
    }
    climate_data_req = requests.get(api_url, params=params, timeout=30)
    if climate_data_req.status_code != 200:
        print("Fetching climate data failed")
        print(climate_data_req.text)
        return climate_data_req.text
    data_df = pd.read_csv(StringIO(climate_data_req.text))
    filtered_df = data_df[
        [
            "tempmax",
            "tempmin",
            "dew",
            "temp",
            "windspeedmin",
            "windspeedmax",
            "windspeedmean",
            "winddir",
            "humidity",
            "conditions",
            "precip",
            "cloudcover",
            "sealevelpressure",
            "precipcover",
        ]
    ].copy()
    humidity_min = filtered_df["humidity"] - 2
    humidity_max = filtered_df["humidity"] + 2
    humidity_mean = (humidity_max + humidity_min) / 2
    filtered_df.rename(
        columns={
            "tempmin": "Minimum Temperature",
            "tempmax": "Maximum Temperature",
            "dew": "Dew Point",
            "temp": "Temperature",
            "windspeedmin": "Wind Speed Min",
            "windspeedmax": "Wind Speed Max",
            "windspeedmean": "Wind Speed Mean",
            "winddir": "Wind Direction",
            "conditions": "Weather Type",
            "precip": "Precipitation",
            "cloudcover": "Cloud Cover",
            "sealevelpressure": "Sea Level Pressure",
            "precipcover": "Precipitation Cover",
        },
        inplace=True,
    )
    filtered_df["Relative Humidity Min"] = humidity_min
    filtered_df["Relative Humidity Max"] = humidity_max
    filtered_df["Relative Humidity Mean"] = humidity_mean
    filtered_df.drop(columns=["humidity", "Weather Type"], inplace=True)
    return filtered_df


def predict(location, start_date, end_date, api_key):
    models = _load_models()
    climate_data_df = fetch_climate_data(location, start_date, end_date, api_key)
    if isinstance(climate_data_df, str):
        print("Prediction failed")
        return climate_data_df

    climate_data_df = climate_data_df.dropna(subset=FEATURE_COLUMNS)
    if climate_data_df.empty:
        return "No complete climate rows were returned for that window"

    features = climate_data_df[FEATURE_COLUMNS]
    result = {}
    for disaster, model in models.items():
        prediction = np.array(model.predict(features))
        result[disaster] = {
            "minimum": round(float(np.min(prediction)), 2),
            "maximum": round(float(np.max(prediction)), 2),
        }
    print(result)
    return result


if __name__ == "__main__":
    predict(
        "80.41,85.9",
        start_date="2023-01-16",
        end_date="2023-01-17",
        api_key=os.getenv("API_KEY"),
    )
