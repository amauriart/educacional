import json
from flask import Flask, jsonify
import requests
from datetime import datetime, timedelta

app = Flask(__name__)

# Carregar config
with open("config.json", "r") as f:
    cfg = json.load(f)

USER = cfg["user"]
TOKEN = cfg["token"]

API_LEAGUES = cfg["api_url_leagues"]
API_FIXTURES = cfg["api_url_fixtures"]
API_ODDS = cfg["api_url_odds"]

# FILTROS
MIN_ODD_OVER05 = 1.10
MIN_ODD_OVER15 = 1.50


def api_get(url, params={}):
    """Faz GET simples para a API soccersapi com user + token."""
    p = {"user": USER, "token": TOKEN}
    p.update(params)
    r = requests.get(url, params=p, timeout=12)
    r.raise_for_status()
    return r.json()


def get_fixtures_next_24h():
    """Busca todos os jogos de futebol das próximas 24 horas."""
    now = datetime.utcnow()
    limit = now + timedelta(hours=24)

    data = api_get(API_FIXTURES, {"t": "list", "d": "inplay,upcoming"})

    resultados = []

    for fx in data.get("data", []):
        try:
            start_raw = fx.get("time", {}).get("starting_at", {}).get("timestamp")
            if not start_raw:
                continue

            start_dt = datetime.utcfromtimestamp(int(start_raw))

            if not (now <= start_dt <= limit):
                continue

            resultados.append({
                "id": fx.get("id"),
                "home": fx.get("localTeam", {}).get("data", {}).get("name", ""),
                "away": fx.get("visitorTeam", {}).get("data", {}).get("name", ""),
                "league": fx.get("league", {}).get("data", {}).get("name", ""),
                "datetime": start_dt
            })
        except:
            continue

    return resultados


def get_odds_for_match(match_id):
    """Busca odds Over 0.5 e Over 1.5 para um jogo específico."""
    try:
        js = api_get(API_ODDS, {"t": "match", "id": match_id})
    except:
        return None

    markets = js.get("data", [])

    best_over05 = None
    best_over15 = None

    for m in markets:
        try:
            name = m.get("name", "").lower()
            outcomes = m.get("bookmakers", [{}])[0].get("odds", [])
        except:
            continue

        for o in outcomes:
            oname = o.get("label", "").lower()
            price = o.get("value")

            if price is None:
                continue

            try:
                price = float(price)
            except:
                continue

            # Over 0.5 goals
            if "over" in oname and "0.5" in oname:
                if price >= MIN_ODD_OVER05:
                    if best_over05 is None or price > best_over05:
                        best_over05 = price

            # Over 1.5 goals
            if "over" in oname and "1.5" in oname:
                if price >= MIN_ODD_OVER15:
                    if best_over15 is None or price > best_over15:
                        best_over15 = price

    return best_over05, best_over15


@app.route("/api/jogos")
def api_jogos():
    fixtures = get_fixtures_next_24h()

    over05 = []
    over15 = []

    for fx in fixtures:
        odds = get_odds_for_match(fx["id"])
        if not odds:
            continue

        o05, o15 = odds

        if o05:
            over05.append({
                "mercado": 0.5,
                "hora": fx["datetime"].strftime("%H:%M"),
                "times": f"{fx['home']} vs {fx['away']}",
                "campeonato": fx["league"],
                "odd": round(o05, 2)
            })

        if o15:
            over15.append({
                "mercado": 1.5,
                "hora": fx["datetime"].strftime("%H:%M"),
                "times": f"{fx['home']} vs {fx['away']}",
                "campeonato": fx["league"],
                "odd": round(o15, 2)
            })

    over05.sort(key=lambda x: x["odd"], reverse=True)
    over15.sort(key=lambda x: x["odd"], reverse=True)

    return jsonify({"over05": over05, "over15": over15})


@app.route("/")
def home():
    return "Scanner SoccersAPI - Operacional"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
