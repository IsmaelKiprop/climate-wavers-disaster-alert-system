"""Train magnitude models from the historical climate CSVs in this repo."""

from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from analysis_model.features import DISASTER_TYPES, FEATURE_COLUMNS

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset" / "disaster types"
MODEL_DIR = BASE_DIR / "model"


def _load_training_frame(disaster_type: str) -> pd.DataFrame:
    path = DATASET_DIR / f"{disaster_type}.csv"
    frame = pd.read_csv(path)
    frame = frame.dropna(subset=["Magnitude", *FEATURE_COLUMNS])
    missing = [column for column in FEATURE_COLUMNS if column not in frame.columns]
    if missing:
        raise KeyError(f"{path.name} is missing columns: {', '.join(missing)}")
    return frame


def build_model(disaster_type: str) -> Path:
    frame = _load_training_frame(disaster_type)
    features = frame[FEATURE_COLUMNS]
    labels = frame["Magnitude"].astype(float)
    model = RandomForestRegressor(
        n_estimators=80,
        max_depth=14,
        min_samples_leaf=2,
        random_state=777,
        n_jobs=1,
    )
    model.fit(features, labels)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    output = MODEL_DIR / f"{disaster_type}.pkl"
    joblib.dump(model, output)
    print(f"Wrote {output} from {len(frame)} rows", flush=True)
    return output


def build() -> None:
    for disaster_type in DISASTER_TYPES:
        build_model(disaster_type)


if __name__ == "__main__":
    build()
