const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para buscar jogos da BETANO
app.get('/api/jogos', async (req, res) => {
    try {
        console.log('=== BUSCANDO JOGOS REAIS DA BETANO ===');
        const jogos = await buscarJogosBetano();
        res.json(jogos);
    } catch (error) {
        console.error('❌ ERRO NA API:', error.message);
        res.json({
            over05: [],
            over15: [],
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: 'ERRO: ' + error.message
        });
    }
});

async function buscarJogosBetano() {
    const ODDS_API_KEY = process.env.ODDS_API_KEY;
    
    console.log('🔑 Chave API configurada:', ODDS_API_KEY ? 'SIM' : 'NÃO');
    
    if (!ODDS_API_KEY) {
        throw new Error('Chave API não configurada no Render');
    }

    // Testar a chave primeiro
    await testarChaveAPI(ODDS_API_KEY);

    const url = 'https://api.the-odds-api.com/v4/sports/soccer/odds';
    
    const params = {
        apiKey: ODDS_API_KEY,
        regions: 'eu,br,us',  // Europa, Brasil, EUA
        markets: 'totals',
        oddsFormat: 'decimal'
    };

    console.log('🌐 Fazendo requisição para The Odds API...');
    
    const response = await axios.get(url, { 
        params, 
        timeout: 15000 
    });

    console.log(`✅ Sucesso! ${response.data.length} jogos recebidos`);

    const jogosComBetano = [];
    const agora = new Date();

    for (const jogo of response.data) {
        // Verificar se tem Betano
        const betano = jogo.bookmakers?.find(b => b.key === 'betano');
        if (!betano) continue;

        // Extrair odds
        const odds = extrairOddsDoJogo(betano);
        
        // Verificar horário (próximas 24h)
        const dataJogo = new Date(jogo.commence_time);
        const diferencaHoras = (dataJogo - agora) / (1000 * 60 * 60);
        
        if (diferencaHoras >= 0 && diferencaHoras <= 24) {
            jogosComBetano.push({
                horario: formatarHorario(jogo.commence_time),
                times: `${jogo.home_team} × ${jogo.away_team}`,
                campeonato: formatarCampeonato(jogo.sport_title),
                oddsOver05: odds.over05,
                oddsOver15: odds.over15
            });
        }
    }

    console.log(`🎯 ${jogosComBetano.length} jogos com Betano nas próximas 24h`);

    // Filtrar e ordenar
    const jogosOver05 = jogosComBetano
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05);

    const jogosOver15 = jogosComBetano
        .filter(j => j.oddsOver15 >= 1.50)
        .sort((a, b) => b.oddsOver15 - a.oddsOver15);

    return {
        over05: jogosOver05,
        over15: jogosOver15,
        atualizacao: new Date().toLocaleTimeString('pt-BR'),
        totalJogos: response.data.length,
        jogosComBetano: jogosComBetano.length,
        sucesso: true,
        mensagem: `Encontrados ${jogosComBetano.length} jogos com Betano`
    };
}

async function testarChaveAPI(apiKey) {
    console.log('🧪 Testando validade da chave API...');
    
    try {
        const response = await axios.get('https://api.the-odds-api.com/v4/sports', {
            params: { apiKey },
            timeout: 10000
        });
        
        if (response.data && response.data.length > 0) {
            console.log('✅ Chave API VÁLIDA!');
            console.log(`📊 ${response.data.length} esportes disponíveis`);
        } else {
            throw new Error('Chave retornou dados vazios');
        }
    } catch (error) {
        console.error('❌ ERRO na chave API:', error.message);
        if (error.response?.status === 401) {
            throw new Error('Chave API inválida ou expirada');
        }
        throw error;
    }
}

function extrairOddsDoJogo(betano) {
    const market = betano.markets?.find(m => m.key === 'totals');
    if (!market) {
        return { over05: 1.00, over15: 1.00 };
    }

    let over05 = 1.00;
    let over15 = 1.00;

    for (const outcome of market.outcomes || []) {
        if (outcome.name === 'over') {
            if (outcome.point === 0.5) {
                over05 = outcome.price || 1.00;
            } else if (outcome.point === 1.5) {
                over15 = outcome.price || 1.00;
            }
        }
    }

    return { over05, over15 };
}

function formatarHorario(isoString) {
    try {
        const data = new Date(isoString);
        return data.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch {
        return '--:--';
    }
}

function formatarCampeonato(nome) {
    const traducoes = {
        'England Premier League': 'Premier League',
        'Spain La Liga': 'La Liga',
        'Italy Serie A': 'Serie A',
        'Germany Bundesliga': 'Bundesliga',
        'France Ligue 1': 'Ligue 1',
        'Brazil Serie A': 'Brasileirão',
        'UEFA Champions League': 'Champions League'
    };
    
    return traducoes[nome] || nome;
}

app.listen(PORT, () => {
    console.log(`🚀 Scanner Betano Online`);
    console.log(`👉 Porta: ${PORT}`);
    console.log(`👉 Chave configurada: ${process.env.ODDS_API_KEY ? 'SIM' : 'NÃO'}`);
});