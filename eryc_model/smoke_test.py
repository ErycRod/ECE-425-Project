from transformers import AutoModelForMultimodalLM, AutoProcessor

MODEL_ID = "HuggingFaceTB/SmolVLM-256M-Instruct"

print("Loading processor...")
processor = AutoProcessor.from_pretrained(MODEL_ID)

print("Loading model...")
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID,
    device_map="auto",
)

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image",
                "url": (
                    "https://huggingface.co/datasets/huggingface/"
                    "documentation-images/resolve/main/p-blog/candy.JPG"
                ),
            },
            {
                "type": "text",
                "text": "Look carefully at the image. What specific animal is pictured? Answer with only the animal name.",
            },
        ],
    }
]

inputs = processor.apply_chat_template(
    messages,
    add_generation_prompt=True,
    tokenize=True,
    return_dict=True,
    return_tensors="pt",
).to(model.device)

print(f"Running on: {model.device}")

outputs = model.generate(
    **inputs,
    max_new_tokens=20,
    do_sample=False,
)

new_tokens = outputs[0][inputs["input_ids"].shape[-1]:]
answer = processor.decode(new_tokens, skip_special_tokens=True)

print("\nModel answer:")
print(answer.strip())