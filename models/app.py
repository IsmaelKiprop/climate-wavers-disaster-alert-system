#!/usr/bin/python3
""" Flask Application """
import os
from os import environ
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from analysis_model.prediction import predict
from recognition_model.recognition import inference
import logging

# Configure the logging settings
# logging.basicConfig(filename='modelserver.log', level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
# # Create a logger instance
# logger = logging.getLogger('modelserver')

app = Flask(__name__)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True
_cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
cors = CORS(app, resources={r"/api/v1/*": {"origins": _cors_origins if "*" not in _cors_origins else "*"}})

@app.route("/api/v1/analysis/inference", methods=['POST'], strict_slashes=False)
def magnitude_analysis():
    print("Here")
    location = request.json['location']
    start_date = request.json['startDate']
    end_date = request.json['endDate']
    key = os.getenv("API_KEY")
    return jsonify(predict(location, start_date, end_date, key))

@app.route('/api/v1/recognition/inference', methods=['POST'])
def disaster_recognition():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    image_file = request.files['image']
    image_path = f'/tmp/{image_file.filename}'
    image_file.save(image_path)
    
    quantized = request.form.get('quantized', 'false').lower() == 'true'
    
    result = inference(image_path, quantized)
    if result is None:
        return jsonify({'error': 'Failed to process image'}), 500
    return jsonify({"inference": result})
    

@app.route("/status", strict_slashes=False)
def status():
    return jsonify({"status": "OK"})

@app.route("/api/v1/analysis/status", strict_slashes=False)
def analysis_status():
    return jsonify({"status": "OK"})

@app.route("/api/v1/recognition/status", strict_slashes=False)
def recognition_status():
    return jsonify({"status": "OK"})

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
    
