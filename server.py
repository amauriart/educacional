# Arquivo: server.py
from flask import Flask, jsonify, send_file
from datetime import datetime, timedelta, timezone # Adicionado 'timezone'
from operator import itemgetter
import os

app = Flask(__name__)

# --- Dados Fictícios de Exemplo (Mock Data) ---
# Você pode editar estes dados mockados
MOCK_GAMES = [
    {
        "time_start": "2025-11-28T23:30:00Z", # Ex: Em 23.5 horas
        "teams": "Time A vs Time B",
        "league": "Liga Fictícia 1",
        "odds_05": 1.15,
        "odds_15": 1.60,
    },
    {
        "time_start": "2025-11-28T10:00:00Z", # Ex: Em 10 horas
        "teams": "Time C vs Time D",
        "league": "Copa Fictícia",
        "odds_05": 1.10,
        "odds_15": 1.40, # Abaixo de 1.50, será filtrado para 1.5
    },
    {
        "time_start": "2025-11-29T18:00:00Z", # Ex: Em > 24 horas, será filtrado
        "teams": "Time E vs Time F",
        "league": "Liga Fictícia 2",
        "odds_05": 1.20,
        "odds_15": 1.80,
    },
    {
        "time_start": "2025-11-27T20:00:00Z", # Ex: Já começou, será filtrado
        "teams": "Time G vs Time H",
        "league": "Liga Fictícia 1",
        "odds_05": 1.18,
        "odds_15": 1.70,
    },
    {
        "time_start": "2025-11-28T12:00:00Z", # Ex: Em 12 horas
        "teams": "Time I vs Time J",
        "league": "Campeonato Fictício",
        "odds_05": 1.25,
        "odds_15": 1.55,
    }
]

def process_games(games):
    """Filtra, processa e ordena os jogos com base nos requisitos."""
    
    # Define a hora atual com contexto de fuso horário UTC (Offset-Aware)
    NOW_UTC = datetime.now(timezone.utc)
    
    # Define o limite de tempo (24 horas a partir de agora)
    time_limit = NOW_UTC + timedelta(hours=24) 
    
    final_results = []

    for game in games:
        # Cria um objeto 'aware' de data/hora a partir da string do mock data
        start_time_utc = datetime.fromisoformat(game["time_start"].replace("Z", "+00:00"))

        # Requisito 5: Somente jogos que começam em no MÁXIMO 24 horas e ainda não começaram
        # Agora a comparação entre 'start_time_utc' e 'NOW_UTC' funciona sem erro
        if start_time_utc > NOW_UTC and start_time_utc <= time_limit:
            
            # Formatação do horário para exibição (Conversão para BRT/UTC-3)
            start_time_brt = start_time_utc - timedelta(hours=3)
            time_display = start_time_brt.strftime("%H:%M") 

            # Cria a estrutura de exibição
            base_data = {
                "horario": time_display,
                "times": game["teams"],
                "campeonato": game["league"],
            }

            # Requisito 2: Over Gols 0.5 >= 1.10
            if game["odds_05"] >= 1.10:
                data_05 = base_data.copy()
                data_05["odds_05"] = game["odds_05"]
                final_results.append({"type": "0.5", **data_05})

            # Requisito 3: Over Gols 1.5 >= 1.50
            if game["odds_15"] >= 1.50:
                data_15 = base_data.copy()
                data_15["odds_15"] = game["odds_15"]
                final_results.append({"type": "1.5", **data_15})
    
    # Requisito 6: Ordenação (0.5 primeiro, depois 1.5, ambos da maior odd para a menor)
    results_05 = [r for r in final_results if r['type'] == '0.5']
    results_15 = [r for r in final_results if r['type'] == '1.5']
    
    # Ordena cada mercado pela odd (maior para menor)
    results_05.sort(key=itemgetter('odds_05'), reverse=True)
    results_15.sort(key=itemgetter('odds_15'), reverse=True)

    # Junta os resultados: 0.5 primeiro, depois 1.5
    return results_05 + results_15

@app.route("/")
def serve_html():
    """Rota principal para servir o arquivo HTML."""
    return send_file('index.html')

@app.route("/scan-data")
def get_scanned_data():
    """Rota para o frontend buscar os dados processados."""
    processed_data = process_games(MOCK_GAMES)
    return jsonify(processed_data)

if __name__ == "__main__":
    # O Render usa a variável de ambiente PORT, ou padronizamos para 5000
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)