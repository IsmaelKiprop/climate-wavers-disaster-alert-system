#!/usr/bin/python3
""" Flask Application """
import os
import tempfile
import urllib.request
from os import environ
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from analysis_model.prediction import analysis_ready, predict
from recognition_model.recognition import inference, recognition_backend

app = Flask(__name__)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True
_cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
cors = CORS(app, resources={r"/api/v1/*": {"origins": _cors_origins if "*" not in _cors_origins else "*"}})

@app.route("/api/v1/analysis/inference", methods=['POST'], strict_slashes=False)
def magnitude_analysis():
    payload = request.get_json(silent=True) or {}
    location = payload.get("location")
    start_date = payload.get("startDate")
    end_date = payload.get("endDate")
    if not location or not start_date or not end_date:
        return jsonify({"error": "location, startDate, and endDate are required"}), 400
    key = os.getenv("API_KEY")
    try:
        result = predict(location, start_date, end_date, key)
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502
    if isinstance(result, str):
        return jsonify({"error": result}), 502
    return jsonify(result)

def _save_recognition_image():
    if "image" in request.files:
        image_file = request.files["image"]
        suffix = os.path.splitext(image_file.filename or "")[1] or ".jpg"
        handle, image_path = tempfile.mkstemp(suffix=suffix)
        os.close(handle)
        image_file.save(image_path)
        quantized = request.form.get("quantized", "false").lower() == "true"
        return image_path, quantized

    payload = request.get_json(silent=True) or {}
    image_url = (payload.get("imageUrl") or payload.get("url") or "").strip()
    if not image_url:
        return None, False
    image_url = image_url.replace("http://", "https://", 1)
    handle, image_path = tempfile.mkstemp(suffix=".jpg")
    os.close(handle)
    req = urllib.request.Request(image_url, headers={"User-Agent": "ClimateWavers/1.0"})
    with urllib.request.urlopen(req, timeout=20) as response:
        with open(image_path, "wb") as out:
            out.write(response.read())
    return image_path, bool(payload.get("quantized"))


@app.route('/api/v1/recognition/inference', methods=['POST'])
def disaster_recognition():
    image_path, quantized = _save_recognition_image()
    if not image_path:
        return jsonify({'error': 'No image file provided'}), 400

    try:
        result = inference(image_path, quantized)
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)
    if result is None:
        return jsonify({'error': 'Failed to process image'}), 500
    label = str(result).replace("AI detected ", "").strip()
    return jsonify({"inference": result, "label": label})
    

@app.route("/status", strict_slashes=False)
def status():
    return jsonify({
        "status": "OK",
        "analysis": "ready" if analysis_ready() else "missing_weights",
        "recognition": recognition_backend(),
    })

@app.route("/api/v1/analysis/status", strict_slashes=False)
def analysis_status():
    return jsonify({"status": "OK" if analysis_ready() else "missing_weights"})

@app.route("/api/v1/recognition/status", strict_slashes=False)
def recognition_status():
    return jsonify({"status": "OK", "backend": recognition_backend()})

@app.errorhandler(404)
def not_found(error):
    """ 404 Error
    ---
    responses:
      404:
        description: a resource was not found
    """
    return make_response(jsonify({'error': "Not found"}), 404)



if __name__ == "__main__":
    """ Main Function """
    host = environ.get('MODEL_HOST')
    port = environ.get('MODEL_PORT')
    if not host:
        host = '0.0.0.0'
    if not port:
        port = '5000'
    app.run(host=host, port=port, threaded=True)
    
