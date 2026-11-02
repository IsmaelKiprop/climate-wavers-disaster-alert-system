import joblib
from sklearn.preprocessing import LabelEncoder
import requests
from io import StringIO
import numpy as np
import os
import pandas as pd
import logging

"""
Run inference on model
"""

# Log server
# Configure the logging settings
# logging.basicConfig(filename='waverx_analysis.log', level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')

# # Create a logger instance
# logger = logging.getLogger('waverx_nlp')


earthquake_model = None
flood_model = None
storm_model = None


def _load_models():
    global earthquake_model, flood_model, storm_model
    if earthquake_model is not None:
        return
    earthquake_path = "analysis_model/model/Earthquake.pkl"
    flood_path = "analysis_model/model/Flood.pkl"
    storm_path = "analysis_model/model/Storm.pkl"
    missing = [path for path in (earthquake_path, flood_path, storm_path) if not os.path.exists(path)]
    if missing:
        raise FileNotFoundError(f"Analysis weights are missing: {', '.join(missing)}")
    earthquake_model = joblib.load(earthquake_path)
    flood_model = joblib.load(flood_path)
    storm_model = joblib.load(storm_path)


def fetch_climate_data(location, start_date, end_date, api_key):
    """
    Fetching climate data at specified time to run inference
    """
    API_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"

    start_date = "{}T00:00:00Z".format(start_date)
    end_date = "{}T23:59:59Z".format(end_date)

    if not api_key:
        api_key = os.getenv("API_KEY", "R9M7HHCH4EDADEUBCU3ZENKXN"), 

    params = {
        "location": location,
        "startTime": start_date,  # start date of disaster
        "endTime": end_date,  # end date of disaster
        "key": api_key,
        "include": "days",
        "contentType": "csv",
        "elements": "tempmax,tempmin,dew,temp,windspeedmin,windspeedmax,windspeedmean,winddir,humidity,conditions,precip,cloudcover,pressure,precipcover",
    }
    climate_data_req = requests.get(API_URL, params=params)
    if climate_data_req.status_code != 200:
        print("Fetching climate data failed")
        print(climate_data_req.text)
        return climate_data_req.text
    print("Data pulled successfully")
    climate_data_req = climate_data_req.text
    climate_data_csv = StringIO(climate_data_req)
    data_df = pd.read_csv(climate_data_csv)
    # Filter specific columns
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
    ]
    # filtered_df.insert(0, "Disaster Type", disaster_type)
    # Calculate relative humidty min, max and mean
    humidity_min = filtered_df["humidity"] - 2
    humidity_max = filtered_df["humidity"] + 2
    humidity_mean = (humidity_max + humidity_min) / 2

    # Set data columns to dataset columns
    dataset_columns = {
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
    }

    # Ensure you're working with a copy of the DataFrame
    filtered_df = filtered_df.copy()

    # Rename columns
    filtered_df.rename(columns=dataset_columns, inplace=True)

    # Assign new columns using .loc
    filtered_df.loc[:, "Relative Humidity Min"] = humidity_min
    filtered_df.loc[:, "Relative Humidity Max"] = humidity_max
    filtered_df.loc[:, "Relative Humidity Mean"] = humidity_mean

    # Drop the "humidity" column
    filtered_df.drop(columns=["humidity"], inplace=True)

    return filtered_df


def predict(location, start_date, end_date, api_key):
    _load_models()
    climate_data_df = fetch_climate_data(location, start_date, end_date, api_key)
    if type(climate_data_df) == str:
        print("Prediction failed")
        return climate_data_df

    # Encode  string values
    label_encoder = LabelEncoder()
    # climate_data_df['Encoded Magnitude Scale'] = label_encoder.fit_transform(climate_data_df['Magnitude Scale'])
    # climate_data_df['Encoded Disaster Type'] = label_encoder.fit_transform(climate_data_df['Disaster Type'])
    climate_data_df["Encoded Weather Type"] = label_encoder.fit_transform(
        climate_data_df["Weather Type"]
    )

    # Drop NaN values
    climate_data_df.dropna(inplace=True)

    X = climate_data_df.drop(columns=["Weather Type"], axis=1)

    predictions = {}
    predictions["Earthquake"] = np.array(earthquake_model.predict(X))
    predictions["Flood"] = np.array(flood_model.predict(X))
    predictions["Storm"] = np.array(storm_model.predict(X))
    # if disaster_type == "Flood":
    #     # Multiply by 1600000 and divide maximum sea level pressure to get km2 value
    #     for mag in predictions:
    #         mag = round((mag * 1600000) / max(climate_data_df['Sea Level Pressure']))
    #         converted_pred.append(mag)
    # elif disaster_type == "Storm":
    #     # Multiply by 30 to get Kph value
    #     for mag in predictions:
    #         mag = round(mag * 300)
    #         converted_pred.append(mag)
    # elif disaster_type == "Earthquake":
    #     # Multiply by 9 to get richter value
    #     for mag in predictions:
    #         mag = round(mag * 9)
    #         converted_pred.append(mag)
    # else:
    #     converted_pred = predictions

    result = {}

    for disaster, prediction in predictions.items():
        result[disaster] = {
            "minimum": round(np.min(prediction)),
            "maximum": round(np.max(prediction)),
        }
    print(result)
    return result


# Example usage
if __name__ == "__main__":
    # Location in Latitude,Longitude format
    # Dates in yyyy-mm-dd format
    predict(
        "80.41,85.9",
        start_date="2023-01-16",
        end_date="2023-01-17",
        api_key=os.getenv("API_KEY"),
    )
