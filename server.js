const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// SUA CHAVE - COPIADA DIRETAMENTE DO SEU COMENTÁRIO
const MINHA_CHAVE_API = '0778fda35c90ecaeab171b863367cb22';

console.log('=== CONFIGURAÇÃO DO SCANNER ===');
console.log('🔑 SUA CHAVE API:', MINHA_CHAVE_API);
console.log('🔑 Chave do Render:', process.env.ODDS_API_KEY || 'Não configurada');
console.log('👉 Vou usar:', process.env.ODDS_API_KEY ? 'Render' : 'Chave fixa');

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de TESTE - Para verificar se a API funciona
app.get('/api/teste', async (req, res) => {
    try {
        console.log('🧪 TESTANDO A API...');
        
        // Usar chave do Render OU a sua chave fixa
        const chave = process.env.ODDS_API_KEY || MINHA_CHAVE_API;
        
        console.log('📡 Testando com chave:', chave.substring(0, 15) + '...');
        
        // Teste SIMPLES - Listar esportes
        const response = await axios.get('https://api.the-odds-api.com/v4/sports', {
            params: { 
                apiKey: chave 
            },
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'BetanoScanner/1.0'
            }
        });
        
        console.log('✅ API RESPONDEU! Esportes:', response.data.length);
        
        res.json({
            sucesso: true,
            mensagem: '🎉 API FUNCIONANDO PERFEITAMENTE!',
            chaveUsada: chave.substring(0, 10) + '...',
            totalEsportes: response.data.length,
            exemploEsportes: response.data.slice(0, 3).map(s => s.title)
        });
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error.message);
        console.error('Status Code:', error.response?.status);
        console.error('Dados do erro:', error.response?.data);
        
        res.json({
            erro: true,
            mensagem: error.message,
            status: error.response?.status,
            detalhes: error.response?.data,
            suaChave: MINHA_CHAVE_API.substring(0, 10) + '...',
            chaveRender: process.env.ODDS_API_KEY ? 'Configurada' : 'Não configurada'
        });
    }
});

// Rota para buscar jogos REAIS
app.get('/api/jogos', async (req, res) => {
    try {
        console.log('⚽ BUSCANDO JOGOS REAIS...');
        
        // Sempre usar SUA chave (prioridade: Render -> Chave fixa)
        const CHAVE_API = process.env.ODDS_API_KEY || MINHA_CHAVE_API;
        
        console.log('🔑 Usando chave:', CHAVE_API.substring(0, 15) + '...');
        
        const url = 'https://api.the-odds-api.com/v4/sports/soccer/odds';
        
        const params = {
            apiKey: CHAVE_API,
            regions: 'eu',  // Começar só com Europa (mais estável)
            markets: 'totals',
            oddsFormat: 'decimal',
            dateFormat: 'iso'
        };

        console.log('🌐 Fazendo requisição para:', url);
        console.log('📊 Parâmetros:', { 
            regions: params.regions, 
            markets: params.markets,
            apiKey: CHAVE_API.substring(0, 10) + '...' 
        });
        
        const response = await axios.get(url, { 
            params, 
            timeout: 20000,  // 20 segundos timeout
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log(`✅ SUCESSO! ${response.data.length} jogos recebidos`);
        
        // Processar jogos
        const agora = new Date();
        const jogosFiltrados = [];
        
        for (const jogo of response.data) {
            // 1. Verificar se tem Betano
            const betano = jogo.bookmakers?.find(b => b.key === 'betano');
            if (!betano) continue;
            
            // 2. Extrair odds
            const odds = extrairOddsBetano(betano);
            
            // 3. Verificar horário (próximas 24h)
            const dataJogo = new Date(jogo.commence_time);
            const diffHoras = (dataJogo - agora) / (1000 * 60 * 60);
            
            if (diffHoras >= 0 && diffHoras <= 24) {
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
        
        // Ordenar por odds mais altas
        const jogosOver05 = jogosFiltrados
            .filter(j => j.oddsOver05 >= 1.10)
            .sort((a, b) => b.oddsOver05 - a.oddsOver05);
        
        const jogosOver15 = jogosFiltrados
            .filter(j => j.oddsOver15 >= 1.50)
            .sort((a, b) => b.oddsOver15 - a.oddsOver15);
        
        res.json({
            over05: jogosOver05,
            over15: jogosOver15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            totalJogos: response.data.length,
            jogosComBetano: jogosFiltrados.length,
            sucesso: true,
            mensagem: `Encontrados ${jogosFiltrados.length} jogos com Betano`
        });
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO:', error.message);
        console.error('Status:', error.response?.status);
        console.error('Dados erro:', error.response?.data);
        
        // Dados de exemplo EM CASO DE ERRO
        const dadosExemplo = gerarDadosExemplo();
        
        res.json({
            over05: dadosExemplo.over05,
            over15: dadosExemplo.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: `API offline. Dados de exemplo. Erro: ${error.message}`,
            totalJogos: 0,
            jogosComBetano: 0
        });
    }
});

// Função para extrair odds da Betano
function extrairOddsBetano(betano) {
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

// Dados de exemplo (fallback)
function gerarDadosExemplo() {
    const jogos = [
        {
            horario: '20:00',
            times: 'Real Madrid × Barcelona',
            campeonato: 'La Liga',
            oddsOver05: 1.15,
            oddsOver15: 1.65
        },
        {
            horario: '21:30',
            times: 'Manchester City × Liverpool',
            campeonato: 'Premier League',
            oddsOver05: 1.12,
            oddsOver15: 1.58
        },
        {
            horario: '19:00',
            times: 'Bayern Munich × Borussia Dortmund',
            campeonato: 'Bundesliga',
            oddsOver05: 1.18,
            oddsOver15: 1.72
        }
    ];
    
    return {
        over05: jogos.filter(j => j.oddsOver05 >= 1.10).sort((a, b) => b.oddsOver05 - a.oddsOver05),
        over15: jogos.filter(j => j.oddsOver15 >= 1.50).sort((a, b) => b.oddsOver15 - a.oddsOver15)
    };
}

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 SCANNER BETANO INICIADO COM SUCESSO!');
    console.log('========================================');
    console.log(`📡 Porta: ${PORT}`);
    console.log(`🔗 Acesse: https://educacional.onrender.com`);
    console.log(`🧪 Teste API: https://educacional.onrender.com/api/teste`);
    console.log(`⚽ Jogos: https://educacional.onrender.com/api/jogos`);
    console.log('========================================');
});