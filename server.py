# server.py
# Flask app que consulta a API pública do Betano e retorna jogos filtrados.
# Requisitos:
# - Expor rota /api/jogos que retorna JSON:
#   { "over05": [...], "over15": [...] }
#
# Observações:
# - Usa o endpoint público do BR (br.betano.com). Se esse endpoint mudar,
#   será preciso ajustar a URL ou trocar para soccersapi.

from flask import Flask, jsonify
import requests
from datetime import datetime, timedelta
import os

app = Flask(__name__)

# URL pública do Betano (futebol). Se quiser testar outro país, troque 'br' por 'pt' etc.
BETANO_API = os.environ.get("BETANO_API_URL", "https://br.betano.com/api/sport/events?sport=1")
# (sport=1 costuma significar futebol em muitos endpoints)

# Thresholds solicitados
MIN_ODD_OVER05 = 1.10
MIN_ODD_OVER15 = 1.50

@app.route("/api/jogos")
def get_jogos():
    try:
        # 1) Pega os dados da Betano
        r = requests.get(BETANO_API, timeout=12)
        r.raise_for_status()
        payload = r.json()

        events = payload.get("events") or payload.get("data") or []
        now = datetime.utcnow()
        limit = now + timedelta(hours=24)

        over05 = []
        over15 = []

        # 2) Itera eventos e extrai mercados/odds
        for ev in events:
            try:
                # Nome do jogo (geralmente "Home vs Away" ou "Home - Away")
                name = ev.get("name") or ev.get("title") or ""
                competition = ev.get("competitionName") or ev.get("competition") or ev.get("competition", "")
                start_ts = ev.get("startTime") or ev.get("start") or ev.get("start_time")
                # startTime costuma vir em ms (timestamp)
                if not start_ts:
                    continue
                # transformar para datetime
                # aceitar float/int ms, ou string ISO
                if isinstance(start_ts, (int, float)):
                    start_dt = datetime.utcfromtimestamp(start_ts / 1000.0)
                else:
                    try:
                        start_dt = datetime.fromisoformat(start_ts.replace("Z", "+00:00"))
                    except Exception:
                        # último recurso: ignore item
                        continue

                # apenas próximos 24h
                if not (now <= start_dt <= limit):
                    continue

                # mercados esperados: cada evento tende a ter "markets" com "selections"
                markets = ev.get("markets") or []

                # varre todos markets -> selections para encontrar Over 0.5 e Over 1.5
                found_over05 = None
                found_over15 = None

                for m in markets:
                    selections = m.get("selections") or []
                    for s in selections:
                        sel_name = s.get("selectionName") or s.get("name") or ""
                        # odd pode estar em 'price' ou 'odds' ou 'priceDec'
                        odd_val = s.get("price") or s.get("priceDec") or s.get("odds") or s.get("priceDecimal") or None
                        # tentar converter para float se for string
                        try:
                            if odd_val is not None:
                                odd_val = float(str(odd_val).replace(",", "."))
                        except:
                            odd_val = None

                        if odd_val is None:
                            continue

                        if "Over 0.5" in sel_name or "Mais de 0.5" in sel_name or "Over0.5" in sel_name:
                            if odd_val >= MIN_ODD_OVER05:
                                found_over05 = odd_val if (found_over05 is None or odd_val > found_over05) else found_over05
                        if "Over 1.5" in sel_name or "Mais de 1.5" in sel_name or "Over1.5" in sel_name:
                            if odd_val >= MIN_ODD_OVER15:
                                found_over15 = odd_val if (found_over15 is None or odd_val > found_over15) else found_over15

                # Se encontrou qualquer um dos mercados, coloca nas listas correspondentes
                if found_over05 is not None:
                    over05.append({
                        "mercado": 0.5,
                        "hora": start_dt.strftime("%H:%M"),
                        "times": name,
                        "campeonato": competition,
                        "odd": round(found_over05, 2)
                    })
                if found_over15 is not None:
                    over15.append({
                        "mercado": 1.5,
                        "hora": start_dt.strftime("%H:%M"),
                        "times": name,
                        "campeonato": competition,
                        "odd": round(found_over15, 2)
                    })

            except Exception:
                # ignora evento problemático
                continue

        # ordenar do maior pro menor
        over05.sort(key=lambda x: x["odd"], reverse=True)
        over15.sort(key=lambda x: x["odd"], reverse=True)

        return jsonify({"over05": over05, "over15": over15})

    except requests.RequestException as e:
        return jsonify({"erro": "falha na requisição externa", "detalhes": str(e)}), 502
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route("/")
def root():
    return "Scanner Betano - API ativa"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
