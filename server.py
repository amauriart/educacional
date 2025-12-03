import json
import os
from flask import Flask, jsonify, send_from_directory
import requests
from datetime import datetime, timedelta

app = Flask(__name__, static_folder="public")

# Carregar config
with open("config.json", "r") as f:
    cfg = json.load(f)

USER = cfg["user"]
TOKEN = cfg["token"]

API_LEAGUES = cfg["api_url_leagues"]
API_FIXTURES = cfg["api_url_fixtures"]
API_ODDS = cfg["api_url_odds"]

MIN_ODD_OVER05 = 1.10
MIN_ODD_OVER15 = 1.50


def api_get(url, params={}):
    p = {"user": USER, "token": TOKEN}
    p.update(params)
    r = requests.get(url, params=p, timeout=15)
    r.raise_for_status()
    return r.json()


@app.route("/")
def home_html():
    return send_from_directory("public", "index.html")


@app.route("/api/jogos")
def api_jogos():
    now = datetime.utcnow()
    limit = now + timedelta(hours=24)

    fx_raw = api_get(API_FIXTURES, {"t": "list", "d": "inplay,upcoming"})
    fixtures = []

    for fx in fx_raw.get("data", []):
        try:
            ts = int(fx["time"]["starting_at"]["timestamp"])
            dt = datetime.utcfromtimestamp(ts)

            if now <= dt <= limit:
                fixtures.append({
                    "id": fx["id"],
                    "home": fx["localTeam"]["data"]["name"],
                    "away": fx["visitorTeam"]["data"]["name"],
                    "league": fx["league"]["data"]["name"],
                    "datetime": dt
                })
        except:
            continue

    over05 = []
    over15 = []

    for f in fixtures:
        try:
            odds_raw = api_get(API_ODDS, {"t": "match", "id": f["id"]})
        except:
            continue

        best05 = None
        best15 = None

        for market in odds_raw.get("data", []):
            for book in market.get("bookmakers", []):
                for odd in book.get("odds", []):
                    name = odd.get("label", "").lower()
                    try:
                        price = float(odd.get("value", 0))
                    except:
                        continue

                    if "over" in name and "0.5" in name:
                        if price >= MIN_ODD_OVER05:
                            if best05 is None or price > best05:
                                best05 = price

                    if "over" in name and "1.5" in name:
                        if price >= MIN_ODD_OVER15:
                            if best15 is None or price > best15:
                                best15 = price

        if best05:
            over05.append({
                "mercado": 0.5,
                "hora": f["datetime"].strftime("%H:%M"),
                "times": f"{f['home']} vs {f['away']}",
                "campeonato": f["league"],
                "odd": round(best05, 2)
            })

        if best15:
            over15.append({
                "mercado": 1.5,
                "hora": f["datetime"].strftime("%H:%M"),
                "times": f"{f['home']} vs {f['away']}",
                "campeonato": f["league"],
                "odd": round(best15, 2)
            })

    over05.sort(key=lambda x: x["odd"], reverse=True)
    over15.sort(key=lambda x: x["odd"], reverse=True)

    return jsonify({"over05": over05, "over15": over15})


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("public", path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
