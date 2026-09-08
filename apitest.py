from openai import OpenAI

client = OpenAI(
    api_key="rsk_live_090a58d9_3lPzcRr2zji3GN4F80L_WwNSvzXiP-O8hK7w3nmuZGw",
    base_url="https://api.ramessar.io/v1",
)

response = client.chat.completions.create(
    model="gpt-oss:20b",
    messages=[
        {
            "role": "user",
            "content": "Say hello from the Ramessar AI API."
        }
    ],
)

print(response.choices[0].message.content)