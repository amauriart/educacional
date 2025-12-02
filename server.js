const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// IMPORTANTE: Ler chave do ambiente Render
const ODDS_API_KEY = process.env.ODDS_API_KEY || '0778fda35c99ecaeab171b863367cb22';

console.log('🔑 Chave API carregada:', ODDS_API_KEY ? 'SIM' : 'NÃO');

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para buscar jogos
app.get('/api/jogos', async (req, res) => {
    try {
        console.log('=== INICIANDO BUSCA DE JOGOS REAIS ===');
        
        if (!ODDS_API_KEY) {
            return res.json({
                over05: [],
                over15: [],
                erro: true,
                mensagem: '❌ ERRO: Variável ODDS_API_KEY não configurada no Render'
            });
        }

        const jogos = await buscarJogosReais();
        res.json(jogos);
        
    } catch (error) {
        console.error('❌ Erro na API:', error.message);
        res.json({
            over05: [],
            over15: [],
            erro: true,
            mensagem: 'Erro: ' + error.message
        });
    }
});

async function buscarJogosReais() {
    console.log('🌐 Buscando dados da API The Odds...');
    
    const url = 'https://api.the-odds-api.com/v4/sports/soccer/odds';
    
    const params = {
        apiKey: ODDS_API_KEY,
        regions: 'eu,br,us',  // Europa, Brasil, EUA
        markets: 'totals',
        oddsFormat: 'decimal',
        dateFormat: 'iso'
    };

    const response = await axios.get(url, { 
        params, 
        timeout: 15000 
    });

    console.log(`✅ API retornou ${response.data.length} jogos`);

    const agora = new Date();
    const jogosFiltrados = [];

    for (const jogo of response.data) {
        // Verificar se tem Betano
        const betano = jogo.bookmakers?.find(b => b.key === 'betano');
        if (!betano) continue;

        // Extrair odds
        const odds = extrairOdds(betano);
        
        // Verificar horário (próximas 24h)
        const dataJogo = new Date(jogo.commence_time);
        const diferencaHoras = (dataJogo - agora) / (1000 * 60 * 60);
        
        if (diferencaHoras >= 0 && diferencaHoras <= 24) {
            jogosFiltrados.push({
                horario: formatarHorario(jogo.commence_time),
                times: `${jogo.home_team} × ${jogo.away_team}`,
                campeonato: formatarCampeonato(jogo.sport_title),
                oddsOver05: odds.over05,
                oddsOver15: odds.over15
            });
        }
    }

    console.log(`🎯 ${jogosFiltrados.length} jogos com Betano nas próximas 24h`);

    // Ordenar por odds
    const jogosOver05 = jogosFiltrados
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05);

    const jogosOver15 = jogosFiltrados
        .filter(j => j.oddsOver15 >= 1.50)
        .sort((a, b) => b.oddsOver15 - a.oddsOver15);

    return {
        over05: jogosOver05,
        over15: jogosOver15,
        atualizacao: new Date().toLocaleTimeString('pt-BR'),
        totalJogos: response.data.length,
        jogosComBetano: jogosFiltrados.length,
        sucesso: true
    };
}

function extrairOdds(betano) {
    const market = betano.markets?.find(m => m.key === 'totals');
    if (!market) return { over05: 1.00, over15: 1.00 };

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
    const data = new Date(isoString);
    return data.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
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
    console.log(`🚀 Scanner Betano rodando na porta ${PORT}`);
    console.log(`👉 Acesse: https://educacional.onrender.com`);
    console.log(`👉 Chave API: ${ODDS_API_KEY ? 'CONFIGURADA' : 'NÃO CONFIGURADA'}`);
});