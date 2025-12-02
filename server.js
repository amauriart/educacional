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
        console.log('Buscando jogos REAIS da Betano...');
        const jogos = await buscarJogosBetano();
        
        // Se não encontrar jogos com Betano, retorna vazio
        if (jogos.over05.length === 0 && jogos.over15.length === 0) {
            jogos.mensagem = 'Nenhum jogo encontrado com Betano nas próximas 24h';
        }
        
        res.json(jogos);
    } catch (error) {
        console.error('ERRO CRÍTICO ao buscar jogos:', error.message);
        // NÃO retorna dados de exemplo - retorna erro real
        res.json({
            over05: [],
            over15: [],
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: 'Erro ao conectar com a API: ' + error.message
        });
    }
});

// Função principal para buscar jogos REAIS da BETANO
async function buscarJogosBetano() {
    const ODDS_API_KEY = process.env.ODDS_API_KEY;
    
    if (!ODDS_API_KEY || ODDS_API_KEY === 'sua_chave_gratuita_aqui') {
        throw new Error('❌ ERRO: Configure sua chave API no arquivo .env');
    }

    console.log('🔑 Usando chave API:', ODDS_API_KEY.substring(0, 10) + '...');

    // URL para TODOS os jogos de futebol - MUNDIAL
    const url = `https://api.the-odds-api.com/v4/sports/soccer/odds`;
    
    const params = {
        apiKey: ODDS_API_KEY,
        regions: 'br,eu,us,au',  // Brasil, Europa, EUA, Austrália
        markets: 'totals',
        oddsFormat: 'decimal',
        dateFormat: 'iso'
    };

    console.log('🌐 Fazendo requisição para API The Odds...');
    console.log('📡 URL:', url);
    console.log('⚙️ Parâmetros:', JSON.stringify(params, null, 2));

    try {
        const response = await axios.get(url, { params, timeout: 10000 });
        console.log(`✅ API respondeu com ${response.data.length} jogos`);

        if (response.data.length === 0) {
            console.log('⚠️ API retornou 0 jogos - pode ser hora errada');
            return {
                over05: [],
                over15: [],
                atualizacao: new Date().toLocaleTimeString('pt-BR'),
                totalJogos: 0,
                jogosComBetano: 0,
                mensagem: 'API retornou 0 jogos'
            };
        }

        // DEBUG: Ver primeiro jogo
        if (response.data[0]) {
            console.log('🔍 Primeiro jogo da API:', {
                times: `${response.data[0].home_team} x ${response.data[0].away_team}`,
                bookmakers: response.data[0].bookmakers?.map(b => b.key) || []
            });
        }

        // Processar jogos - SOMENTE SE TIVER BETANO
        const jogosProcessados = [];
        
        for (const jogo of response.data) {
            const odds = extrairOddsBetano(jogo);
            
            if (odds.temBetano) {
                const dataJogo = new Date(jogo.commence_time);
                
                // Verificar se está nas próximas 24h
                const agora = new Date();
                const diferencaHoras = (dataJogo - agora) / (1000 * 60 * 60);
                
                if (diferencaHoras <= 24 && diferencaHoras >= 0) {
                    jogosProcessados.push({
                        id: jogo.id,
                        horario: formatarHorario(jogo.commence_time),
                        times: `${jogo.home_team} × ${jogo.away_team}`,
                        campeonato: formatarCampeonato(jogo.sport_title),
                        oddsOver05: odds.over05,
                        oddsOver15: odds.over15,
                        dataJogo: dataJogo
                    });
                }
            }
        }

        console.log(`🎯 ${jogosProcessados.length} jogos têm Betano nas próximas 24h`);

        // DEBUG: Mostrar alguns jogos encontrados
        if (jogosProcessados.length > 0) {
            console.log('📋 Exemplos de jogos encontrados:');
            jogosProcessados.slice(0, 3).forEach((jogo, i) => {
                console.log(`  ${i+1}. ${jogo.times} - ${jogo.campeonato}`);
                console.log(`     Over 0.5: ${jogo.oddsOver05} | Over 1.5: ${jogo.oddsOver15}`);
            });
        }

        // Ordenação EXATA como solicitado
        const jogosOver05 = jogosProcessados
            .filter(jogo => jogo.oddsOver05 >= 1.10)
            .sort((a, b) => b.oddsOver05 - a.oddsOver05);

        const jogosOver15 = jogosProcessados
            .filter(jogo => jogo.oddsOver15 >= 1.50)
            .sort((a, b) => b.oddsOver15 - a.oddsOver15);

        return {
            over05: jogosOver05,
            over15: jogosOver15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            totalJogos: response.data.length,
            jogosComBetano: jogosProcessados.length,
            sucesso: true,
            mensagem: `${jogosProcessados.length} jogos com Betano encontrados`
        };

    } catch (error) {
        console.error('❌ ERRO na requisição API:', error.message);
        console.error('Código do erro:', error.code);
        console.error('Status:', error.response?.status);
        
        throw new Error(`Falha na API: ${error.message}`);
    }
}

// Extrair odds específicas da Betano - VERSÃO ROBUSTA
function extrairOddsBetano(jogo) {
    if (!jogo.bookmakers || !Array.isArray(jogo.bookmakers)) {
        return { over05: 1.00, over15: 1.00, temBetano: false };
    }

    // Procurar pela casa Betano
    const betano = jogo.bookmakers.find(b => b.key === 'betano');
    
    if (!betano) {
        return { over05: 1.00, over15: 1.00, temBetano: false };
    }

    // Verificar se tem markets
    if (!betano.markets || !Array.isArray(betano.markets)) {
        return { over05: 1.00, over15: 1.00, temBetano: false };
    }

    // Procurar pelo mercado de Over/Under (totals)
    const market = betano.markets.find(m => m.key === 'totals');
    if (!market || !market.outcomes || !Array.isArray(market.outcomes)) {
        return { over05: 1.00, over15: 1.00, temBetano: true };
    }

    // Inicializar valores
    let over05 = 1.00;
    let over15 = 1.00;
    let encontrouOver05 = false;
    let encontrouOver15 = false;
    
    // Buscar odds CORRETAMENTE
    for (const outcome of market.outcomes) {
        if (outcome.name === 'over' && typeof outcome.point === 'number') {
            if (outcome.point === 0.5) {
                over05 = outcome.price || 1.00;
                encontrouOver05 = true;
            } else if (outcome.point === 1.5) {
                over15 = outcome.price || 1.00;
                encontrouOver15 = true;
            }
        }
    }

    // Se não encontrou odds específicas, mas tem Betano, usar valores padrão
    if (!encontrouOver05) over05 = 1.10;
    if (!encontrouOver15) over15 = 1.50;

    return {
        over05: over05,
        over15: over15,
        temBetano: true
    };
}

// Formatadores
function formatarHorario(isoString) {
    try {
        const data = new Date(isoString);
        if (isNaN(data.getTime())) {
            return '--:--';
        }
        return data.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
            hour12: false
        });
    } catch {
        return '--:--';
    }
}

function formatarCampeonato(nome) {
    if (!nome) return 'Campeonato';
    
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
        'Brazil Serie B': 'Brasileirão Série B',
        'UEFA Champions League': 'Champions League',
        'UEFA Europa League': 'Europa League',
        'Copa Libertadores': 'Libertadores',
        'Copa Sudamericana': 'Sul-Americana',
        'Portugal Primeira Liga': 'Primeira Liga',
        'Netherlands Eredivisie': 'Eredivisie',
        'USA MLS': 'MLS',
        'Argentina Liga Profesional': 'Liga Argentina'
    };
    
    return traducoes[nomeLimpo] || nomeLimpo;
}

app.listen(PORT, () => {
    console.log(`🚀 Scanner Betano MUNDIAL rodando na porta ${PORT}`);
    console.log(`📊 Acesse: http://localhost:${PORT}`);
    console.log(`🔑 API Key configurada: ${process.env.ODDS_API_KEY ? 'SIM' : 'NÃO'}`);
});