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
        // Fallback para dados exemplo se API falhar
        res.json(gerarDadosExemplo());
    }
});

// Função principal para buscar jogos da BETANO
async function buscarJogosBetano() {
    const ODDS_API_KEY = process.env.ODDS_API_KEY;
    
    if (!ODDS_API_KEY || ODDS_API_KEY === 'sua_chave_gratuita_aqui') {
        throw new Error('Configure sua chave API no arquivo .env');
    }

    const url = `https://api.the-odds-api.com/v4/sports/soccer_brazil_campeonato/odds`;
    
    const params = {
        apiKey: ODDS_API_KEY,
        regions: 'br',
        markets: 'totals',
        oddsFormat: 'decimal',
        bookmakers: 'betano'  // FILTRO APENAS BETANO
    };

    const response = await axios.get(url, { params });
    console.log(`✅ API respondeu com ${response.data.length} jogos`);

    // Processar jogos
    const jogosProcessados = response.data.map(jogo => {
        const odds = extrairOddsBetano(jogo);
        return {
            id: jogo.id,
            horario: formatarHorario(jogo.commence_time),
            times: `${jogo.home_team} × ${jogo.away_team}`,
            campeonato: formatarCampeonato(jogo.sport_title),
            oddsOver05: odds.over05,
            oddsOver15: odds.over15,
            dataJogo: new Date(jogo.commence_time)
        };
    });

    // Aplicar filtros
    const jogosFiltrados = jogosProcessados
        .filter(jogo => filtrarProximas24Horas(jogo.dataJogo))
        .filter(jogo => jogo.oddsOver05 >= 1.10 || jogo.oddsOver15 >= 1.50);

    console.log(`🎯 ${jogosFiltrados.length} jogos após filtros`);

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
        atualizacao: new Date().toLocaleTimeString('pt-BR')
    };
}

// Extrair odds específicas da Betano
function extrairOddsBetano(jogo) {
    const betano = jogo.bookmakers.find(b => b.key === 'betano');
    
    if (!betano) {
        return { over05: 1.10, over15: 1.50 };
    }

    const market = betano.markets.find(m => m.key === 'totals');
    if (!market) {
        return { over05: 1.10, over15: 1.50 };
    }

    // Buscar odds Over 0.5
    const over05 = market.outcomes.find(o => o.name === 'over' && o.point === 0.5);
    // Buscar odds Over 1.5
    const over15 = market.outcomes.find(o => o.name === 'over' && o.point === 1.5);

    return {
        over05: over05 ? over05.price : 1.10,
        over15: over15 ? over15.price : 1.50
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
    // Simplificar nome do campeonato
    return nome.replace('Soccer', '').trim();
}

// Dados de exemplo (fallback)
function gerarDadosExemplo() {
    const agora = new Date();
    const jogos = [];
    
    const timesExemplo = [
        'Flamengo × Corinthians', 'São Paulo × Palmeiras',
        'Grêmio × Internacional', 'Athletico-PR × Coritiba',
        'Botafogo × Vasco', 'Fortaleza × Ceará'
    ];
    
    const campeonatos = [
        'Brasileirão Série A', 'Copa do Brasil', 
        'Libertadores', 'Sul-Americana'
    ];

    for (let i = 0; i < 8; i++) {
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
    console.log(`🚀 Scanner Betano rodando na porta ${PORT}`);
    console.log(`📊 Acesse: http://localhost:${PORT}`);
});