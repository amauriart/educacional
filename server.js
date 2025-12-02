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
        console.log('Buscando jogos da Betano...');
        const jogos = await buscarJogosBetano();
        res.json(jogos);
    } catch (error) {
        console.error('Erro ao buscar jogos:', error);
        res.json(gerarDadosExemplo());
    }
});

// Função principal para buscar jogos da BETANO
async function buscarJogosBetano() {
    const ODDS_API_KEY = process.env.ODDS_API_KEY;
    
    if (!ODDS_API_KEY || ODDS_API_KEY === 'sua_chave_gratuita_aqui') {
        throw new Error('Configure sua chave API no arquivo .env');
    }

    // URL para TODOS os jogos de futebol
    const url = `https://api.the-odds-api.com/v4/sports/soccer/odds`;
    
    const params = {
        apiKey: ODDS_API_KEY,
        regions: 'br,eu,us',  // Brasil, Europa, Estados Unidos
        markets: 'totals',
        oddsFormat: 'decimal'
    };

    console.log('Fazendo requisição para API...');
    const response = await axios.get(url, { params });
    console.log(`✅ API respondeu com ${response.data.length} jogos`);

    // Processar jogos - SOMENTE SE TIVER BETANO
    const jogosProcessados = response.data
        .map(jogo => {
            const odds = extrairOddsBetano(jogo);
            return {
                id: jogo.id,
                horario: formatarHorario(jogo.commence_time),
                times: `${jogo.home_team} × ${jogo.away_team}`,
                campeonato: formatarCampeonato(jogo.sport_title),
                oddsOver05: odds.over05,
                oddsOver15: odds.over15,
                dataJogo: new Date(jogo.commence_time),
                temBetano: odds.temBetano
            };
        })
        .filter(jogo => jogo.temBetano);

    console.log(`🎯 ${jogosProcessados.length} jogos têm Betano`);

    // Aplicar filtros de tempo
    const jogos24h = jogosProcessados
        .filter(jogo => filtrarProximas24Horas(jogo.dataJogo));

    console.log(`⏰ ${jogos24h.length} jogos nas próximas 24h`);

    // Aplicar filtros de odds
    const jogosFiltrados = jogos24h
        .filter(jogo => jogo.oddsOver05 >= 1.10 || jogo.oddsOver15 >= 1.50);

    console.log(`📊 ${jogosFiltrados.length} jogos após filtros de odds`);

    // Ordenação EXATA como solicitado
    const jogosOver05 = jogosFiltrados
        .filter(jogo => jogo.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05);

    const jogosOver15 = jogosFiltrados
        .filter(jogo => jogo.oddsOver15 >= 1.50)
        .sort((a, b) => b.oddsOver15 - a.oddsOver15);

    return {
        over05: jogosOver05,
        over15: jogosOver15,
        atualizacao: new Date().toLocaleTimeString('pt-BR'),
        totalJogos: response.data.length,
        jogosComBetano: jogosProcessados.length
    };
}

// Extrair odds específicas da Betano - VERSÃO CORRIGIDA
function extrairOddsBetano(jogo) {
    // Procurar pela casa Betano
    const betano = jogo.bookmakers.find(b => b.key === 'betano');
    
    // Se não encontrar Betano, retorna valores baixos
    if (!betano) {
        return { over05: 1.00, over15: 1.00, temBetano: false };
    }

    // Procurar pelo mercado de Over/Under (totals)
    const market = betano.markets.find(m => m.key === 'totals');
    if (!market) {
        return { over05: 1.00, over15: 1.00, temBetano: false };
    }

    // Inicializar valores
    let over05 = 1.00;
    let over15 = 1.00;
    
    // Buscar odds CORRETAMENTE
    for (const outcome of market.outcomes) {
        if (outcome.name === 'over') {
            if (outcome.point === 0.5) {
                over05 = outcome.price;
            } else if (outcome.point === 1.5) {
                over15 = outcome.price;
            }
        }
    }

    return {
        over05: over05,
        over15: over15,
        temBetano: true
    };
}

// Filtrar apenas jogos nas próximas 24 horas
function filtrarProximas24Horas(dataJogo) {
    const agora = new Date();
    const diferencaHoras = (dataJogo - agora) / (1000 * 60 * 60);
    return diferencaHoras <= 24 && diferencaHoras >= 0;
}

// Formatadores
function formatarHorario(isoString) {
    const data = new Date(isoString);
    return data.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });
}

function formatarCampeonato(nome) {
    // Melhorar nomes de campeonatos
    let nomeLimpo = nome.replace('Soccer', '')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                        .trim();
    
    // Traduzir alguns nomes comuns
    const traducoes = {
        'England Premier League': 'Premier League',
        'Spain La Liga': 'La Liga',
        'Italy Serie A': 'Serie A',
        'Germany Bundesliga': 'Bundesliga',
        'France Ligue 1': 'Ligue 1',
        'Brazil Serie A': 'Brasileirão',
        'UEFA Champions League': 'Champions League',
        'UEFA Europa League': 'Europa League',
        'Copa Libertadores': 'Libertadores',
        'Copa Sudamericana': 'Sul-Americana',
        'Portugal Primeira Liga': 'Primeira Liga',
        'Netherlands Eredivisie': 'Eredivisie'
    };
    
    return traducoes[nomeLimpo] || nomeLimpo;
}

// Dados de exemplo (fallback)
function gerarDadosExemplo() {
    const agora = new Date();
    const jogos = [];
    
    const timesExemplo = [
        'Real Madrid × Barcelona', 'Manchester City × Liverpool',
        'Bayern Munich × Borussia Dortmund', 'PSG × Marseille',
        'Juventus × Milan', 'Atlético Madrid × Sevilla',
        'Flamengo × Corinthians', 'São Paulo × Palmeiras',
        'Benfica × Porto', 'Ajax × PSV'
    ];
    
    const campeonatos = [
        'Premier League', 'La Liga', 'Serie A', 'Bundesliga',
        'Ligue 1', 'Brasileirão', 'Champions League', 'Libertadores',
        'Primeira Liga', 'Eredivisie'
    ];

    for (let i = 0; i < 12; i++) {
        const hora = (agora.getHours() + Math.floor(Math.random() * 24)) % 24;
        const horario = `${hora.toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
        
        jogos.push({
            id: i,
            horario: horario,
            times: timesExemplo[i % timesExemplo.length],
            campeonato: campeonatos[i % campeonatos.length],
            oddsOver05: parseFloat((1.10 + Math.random() * 0.4).toFixed(2)),
            oddsOver15: parseFloat((1.50 + Math.random() * 0.6).toFixed(2))
        });
    }

    const over05 = jogos.filter(j => j.oddsOver05 >= 1.10).sort((a, b) => b.oddsOver05 - a.oddsOver05);
    const over15 = jogos.filter(j => j.oddsOver15 >= 1.50).sort((a, b) => b.oddsOver15 - a.oddsOver15);

    return {
        over05: over05,
        over15: over15,
        atualizacao: new Date().toLocaleTimeString('pt-BR') + ' (Dados Exemplo)'
    };
}

app.listen(PORT, () => {
    console.log(`🚀 Scanner Betano MUNDIAL rodando na porta ${PORT}`);
    console.log(`📊 Acesse: http://localhost:${PORT}`);
});