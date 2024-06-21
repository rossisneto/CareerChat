import flet as ft
import requests
import matplotlib.pyplot as plt
import numpy as np

def main(page: ft.Page):
    page.title = "ChatBot Especialista em Carreira"
    page.vertical_alignment = ft.MainAxisAlignment.CENTER

    messages = ft.Column()
    input_text = ft.TextField(label="Digite sua mensagem:", width=400)

    def send_message(e):
        user_message = input_text.value
        messages.controls.append(ft.Text(f"Você: {user_message}", color="blue"))
        input_text.value = ""

        response = requests.post("http://localhost:3000/api/message", json={"user": "user1", "message": user_message})
        bot_message = response.json()["response"]
        messages.controls.append(ft.Text(f"Bot: {bot_message}", color="green"))
        
        page.update()

    def generate_chart(e):
        response = requests.get("http://localhost:3000/api/generate_chart?user=user1")
        with open("radar_chart.png", "wb") as f:
            f.write(response.content)
        messages.controls.append(ft.Image(src="radar_chart.png", width=400, height=400))
        page.update()

    send_button = ft.ElevatedButton(text="Enviar", on_click=send_message)
    chart_button = ft.ElevatedButton(text="Gerar Gráfico", on_click=generate_chart)

    page.add(
        messages,
        input_text,
        send_button,
        chart_button,
    )

ft.app(target=main)
