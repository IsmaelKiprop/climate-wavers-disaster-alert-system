import cv2
import numpy as np
from pathlib import Path
from openvino import Core

model_path = Path("recognition_model/models/ov_model/")
model = Path(f"{model_path}/model.xml")
weights = Path(f"{model_path}/model.bin")

quantized_model_path = Path("recognition_model/models/quantized_model/")
quantized_model = Path(f"{quantized_model_path}/quantized_model.xml")
quantized_weights = Path(f"{quantized_model_path}/quantized_model.bin")

compiled_model = None
compiled_quantized_model = None


def _load_models():
    global compiled_model, compiled_quantized_model
    if compiled_model is not None:
        return compiled_model, compiled_quantized_model
    if not model.exists() or not weights.exists():
        raise FileNotFoundError(
            f"Recognition weights are missing. Expected {model} and {weights}."
        )
    core = Core()
    compiled_model = core.compile_model(model=model, device_name="CPU")
    if quantized_model.exists() and quantized_weights.exists():
        compiled_quantized_model = core.compile_model(model=quantized_model, device_name="CPU")
    return compiled_model, compiled_quantized_model


def inference(image_file, quantized=False):
    normal_model, quantized_compiled = _load_models()
    image = cv2.imread(filename=image_file)
    if image is None:
        return None
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
            raise FileNotFoundError("Quantized recognition weights are missing.")
        input_layer = quantized_compiled.input(0)
        output_layer = quantized_compiled.output(0)
        quantized_result = quantized_compiled(inputs={input_layer: input_image})[output_layer]
        result_index = np.argmax(quantized_result)
        return f"AI detected {result_classes[result_index]}"

    input_layer = normal_model.input(0)
    output_layer = normal_model.output(0)
    normal_result = normal_model(inputs={input_layer: input_image})[output_layer]
    result_index = np.argmax(normal_result)
    return f"AI detected {result_classes[result_index]}"

    


