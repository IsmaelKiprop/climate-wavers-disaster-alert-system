import cv2
import numpy as np
from pathlib import Path

from recognition_model.imagenet_map import DISASTER_CLASSES, disaster_from_indices

model_path = Path("recognition_model/models/ov_model/")
model = Path(f"{model_path}/model.xml")
weights = Path(f"{model_path}/model.bin")

quantized_model_path = Path("recognition_model/models/quantized_model/")
quantized_model = Path(f"{quantized_model_path}/quantized_model.xml")
quantized_weights = Path(f"{quantized_model_path}/quantized_model.bin")

onnx_model = Path("recognition_model/models/mobilenetv2-10.onnx")

compiled_model = None
compiled_quantized_model = None
onnx_net = None
_ov_attempted = False
_onnx_attempted = False


def recognition_backend():
    if weights.exists() and model.exists():
        return "openvino"
    if onnx_model.exists():
        return "mobilenet"
    return "scene"


def _load_openvino():
    global compiled_model, compiled_quantized_model, _ov_attempted
    if compiled_model is not None or _ov_attempted:
        return compiled_model, compiled_quantized_model
    _ov_attempted = True
    if not model.exists() or not weights.exists():
        return None, None
    from openvino import Core

    core = Core()
    compiled_model = core.compile_model(model=model, device_name="CPU")
    if quantized_model.exists() and quantized_weights.exists():
        compiled_quantized_model = core.compile_model(
            model=quantized_model, device_name="CPU"
        )
    return compiled_model, compiled_quantized_model


def _load_onnx():
    global onnx_net, _onnx_attempted
    if onnx_net is not None or _onnx_attempted:
        return onnx_net
    _onnx_attempted = True
    if not onnx_model.exists():
        return None
    onnx_net = cv2.dnn.readNetFromONNX(str(onnx_model))
    return onnx_net


def _openvino_inference(image, quantized=False):
    normal_model, quantized_compiled = _load_openvino()
    resized_image = cv2.resize(src=image, dsize=(224, 224))
    input_image = np.expand_dims(np.transpose(resized_image, (1, 0, 2)), 0)
    result_classes = [
        "Earthquake",
        "Drought",
        "Damaged Infrastructure",
        "Human Damage",
        "Human",
        "Land Slide",
        "Non Damage Buildings and  Street",
        "Non Damage Wildlife Forest",
        "Sea",
        "Urban Fire",
        "Wild Fire",
        "Water Disaster",
    ]
    if quantized:
        if quantized_compiled is None:
            return None
        input_layer = quantized_compiled.input(0)
        output_layer = quantized_compiled.output(0)
        quantized_result = quantized_compiled(inputs={input_layer: input_image})[
            output_layer
        ]
        result_index = int(np.argmax(quantized_result))
        return f"AI detected {result_classes[result_index]}"

    if normal_model is None:
        return None
    input_layer = normal_model.input(0)
    output_layer = normal_model.output(0)
    normal_result = normal_model(inputs={input_layer: input_image})[output_layer]
    result_index = int(np.argmax(normal_result))
    return f"AI detected {result_classes[result_index]}"


def _onnx_inference(image):
    net = _load_onnx()
    if net is None:
        return None
    blob = cv2.dnn.blobFromImage(
        image,
        scalefactor=0.017,
        size=(224, 224),
        mean=(103.94, 116.78, 123.68),
        swapRB=False,
        crop=False,
    )
    net.setInput(blob)
    output = net.forward()
    scores = np.squeeze(output)
    top = np.argsort(scores)[::-1][:5]
    label = disaster_from_indices(top, scores[top])
    if not label:
        return None
    return f"AI detected {label}"


def _scene_inference(image):
    """OpenCV scene prior used when neural weights are not on disk."""
    resized = cv2.resize(image, (224, 224))
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    b, g, r = cv2.split(resized)
    b_mean, g_mean, r_mean = float(np.mean(b)), float(np.mean(g)), float(np.mean(r))
    total = b_mean + g_mean + r_mean + 1e-6
    blue_ratio = b_mean / total
    green_ratio = g_mean / total
    red_ratio = r_mean / total
    sat = float(np.mean(hsv[:, :, 1]))
    val = float(np.mean(hsv[:, :, 2]))
    hue = float(np.mean(hsv[:, :, 0]))
    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.mean(edges > 0))
    texture = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    scores = {label: 0.0 for label in DISASTER_CLASSES}

    if blue_ratio > 0.38 and val > 70:
        scores["Sea"] += 3.0 + blue_ratio
        scores["Water Disaster"] += 2.2 + edge_density
    if blue_ratio > 0.32 and sat > 60:
        scores["Water Disaster"] += 2.0
    if green_ratio > 0.38:
        scores["Non Damage Wildlife Forest"] += 3.0 + green_ratio
    if red_ratio > 0.38 and sat > 80 and (hue < 20 or hue > 160):
        scores["Wild Fire"] += 3.2
        scores["Urban Fire"] += 1.6 + edge_density * 2
    if red_ratio > 0.34 and edge_density > 0.12:
        scores["Urban Fire"] += 2.4
    if val > 150 and sat < 55 and green_ratio < 0.32:
        scores["Drought"] += 2.8
    if edge_density > 0.16 and sat < 70:
        scores["Non Damage Buildings and  Street"] += 2.5
        scores["Damaged Infrastructure"] += 1.4 + (texture / 400.0)
    if texture > 400 and green_ratio < 0.3 and blue_ratio < 0.32:
        scores["Earthquake"] += 2.0
        scores["Land Slide"] += 1.8
    if 5 < hue < 30 and sat > 40 and 40 < val < 180:
        scores["Human"] += 2.2
        scores["Human Damage"] += 1.2 + (red_ratio * 2)
    if edge_density > 0.2 and red_ratio > 0.3:
        scores["Human Damage"] += 1.6
        scores["Damaged Infrastructure"] += 1.4
    if 10 < hue < 30 and sat > 50 and green_ratio < 0.35 and blue_ratio < 0.3:
        scores["Land Slide"] += 1.8

    label = max(scores, key=scores.get)
    return f"AI detected {label}"


def inference(image_file, quantized=False):
    image = cv2.imread(filename=image_file)
    if image is None:
        return None
    if quantized or recognition_backend() == "openvino":
        result = _openvino_inference(image, quantized=quantized)
        if result:
            return result
    onnx_result = _onnx_inference(image)
    if onnx_result:
        return onnx_result
    return _scene_inference(image)
