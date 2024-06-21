import flet as ft
import requests
import matplotlib.pyplot as plt
import numpy as np

def main(page: ft.Page):
    page.title = "ChatBot Especialista em Carreira"
    page.vertical_alignment = ft.MainAxisAlignment.CENTER

    messages_ref = ft.Ref[ft.Column]()
    end_ref = ft.Ref[ft.Container]()
    messages = ft.Column(ref=messages_ref, scroll="always", expand=True)
    input_text = ft.TextField(label="Digite sua mensagem:", expand=True)
    download_link = ft.Text()

    def scroll_to_bottom():
        page.controls.append(ft.Container(ref=end_ref, expand=True))
        page.update()
        end_ref.current.scroll_to()

    def load_initial_message():
        initial_message = "Bem-vindo à entrevista de carreira! Vamos começar.\n\n" + get_next_question()
        messages.controls.append(ft.Text(f"Bot: {initial_message}", color="green"))
        page.update()
        #scroll_to_bottom()

    def get_next_question():
        response = requests.get("http://localhost:3000/api/next_question")
        return response.json()["question"]

    def send_message(e):
        user_message = input_text.value
        if user_message:
            messages.controls.append(ft.Text(f"Você: {user_message}", color="blue"))
            page.update()
            #scroll_to_bottom()

            input_text.value = ""

            response = requests.post("http://localhost:3000/api/message", json={"user": "user1", "message": user_message})
            bot_message = response.json()["response"]
            messages.controls.append(ft.Text(f"Bot: {bot_message}", color="green"))
            
            if "Temos informações suficientes" in bot_message:
                download_link.value = "Download Currículo"
                download_link.url = "http://localhost:3000/api/download_resume?user=user1"
                page.update()
                
            page.update()
            #scroll_to_bottom()

    def generate_chart(e):
        response = requests.get("http://localhost:3000/api/generate_chart?user=user1")
        with open("radar_chart.png", "wb") as f:
            f.write(response.content)
        messages.controls.append(ft.Image(src="radar_chart.png", width=400, height=400))
        page.update()
        #scroll_to_bottom()

    send_button = ft.ElevatedButton(text="Enviar", on_click=send_message)
    chart_button = ft.ElevatedButton(text="Gerar Gráfico", on_click=generate_chart)

    page.add(
        ft.Container(
            content=messages,
            expand=True
        ),
        ft.Row([input_text, send_button], expand=True),
        chart_button,
        download_link
    )

    load_initial_message()

ft.app(target=main)
