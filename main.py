"""
YouTube Growth & SEO Studio (vidIQ Web Suite)
Entry Point: Launches the Web Dashboard Server
"""

import sys
import webbrowser
import uvicorn


def main():
    port = 8000
    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    
    print("=" * 60)
    print("🚀 YOUTUBE GROWTH & SEO STUDIO (vidIQ Web Suite)")
    print("=" * 60)
    print(f"📊 Сервер запущен: {url}")
    print("⚡ Открываем веб-интерфейс в браузере...")
    print("Нажмите Ctrl+C для остановки сервера.")
    print("=" * 60)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    uvicorn.run("app:app", host=host, port=port, reload=True)


if __name__ == "__main__":
    main()
