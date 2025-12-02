const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// SUAS CREDENCIAIS REAIS
const SOCCERSAPI_USER = process.env.SOCCERSAPI_USER || '0x3YU';
const SOCCERSAPI_TOKEN = process.env.SOCCERSAPI_TOKEN || 'UVZnFqmGWH';

console.log('🚀 Scanner Betano - DADOS REAIS da SoccerAPI');
console.log('👤 Usuário:', SOCCERSAPI_USER);
console.log('🔐 Token:', SOCCERSAPI_TOKEN.substring(0, 6) + '...');

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para buscar jogos REAIS
app.get('/api/jogos', async (req, res) => {
    console.log('\n🔄 BUSCANDO DADOS REAIS DA SOCCERSAPI...');
    
    try {
        // 1. Buscar jogos das próximas 48h
        const jogos = await buscarJogosReais();
        
        // 2. Para cada jogo, buscar odds REAIS
        const jogosComOddsReais = [];
        
        for (const jogo of jogos.slice(0, 10)) { // Limitar a 10 para ser rápido
            try {
                const oddsReais = await buscarOddsReais(jogo.id);
                
                if (oddsReais) {
                    jogosComOddsReais.push({
                        horario: jogo.horario,
                        times: jogo.times,
                        campeonato: jogo.campeonato,
                        oddsOver05: oddsReais.over05,
                        oddsOver15: oddsReais.over15
                    });
                }
                
                // Pequena pausa para não sobrecarregar a API
                await delay(100);
                
            } catch (error) {
                console.log(`⚠️ Ignorando jogo ${jogo.id}: ${error.message}`);
                continue;
            }
        }
        
        console.log(`✅ ${jogosComOddsReais.length} jogos com odds reais encontrados`);
        
        // 3. Separar e ordenar
        const resultado = processarResultados(jogosComOddsReais);
        
        // 4. Enviar resposta
        res.json({
            over05: resultado.over05,
            over15: resultado.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            estatisticas: {
                over05: resultado.over05.length,
                over15: resultado.over15.length,
                totalJogos: jogos.length,
                jogosComOdds: jogosComOddsReais.length,
                fonte: 'soccersapi-odds-reais'
            },
            sucesso: true,
            mensagem: `Dados REAIS da SoccerAPI - ${jogosComOddsReais.length} jogos com odds`
        });
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO:', error.message);
        
        // Fallback apenas se não conseguir NADA da API
        const fallback = await tentarBuscaMinima();
        
        res.json({
            over05: fallback.over05,
            over15: fallback.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: `API retornou sem dados de odds. Erro: ${error.message}`,
            estatisticas: {
                over05: fallback.over05.length,
                over15: fallback.over15.length,
                fonte: 'fallback-minimo'
            }
        });
    }
});

// BUSCAR JOGOS REAIS (eventos)
async function buscarJogosReais() {
    console.log('📅 Buscando jogos das próximas 48h...');
    
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 2);
    
    const url = 'https://api.soccersapi.com/v2.2/events/';
    const params = {
        user: SOCCERSAPI_USER,
        token: SOCCERSAPI_TOKEN,
        t: 'schedule',
        from: formatarData(hoje),
        to: formatarData(amanha),
        per_page: 30
    };
    
    try {
        const response = await axios.get(url, { 
            params, 
            timeout: 15000 
        });
        
        const eventos = response.data?.data || [];
        console.log(`📊 ${eventos.length} eventos encontrados`);
        
        // Processar eventos
        const jogos = [];
        const agora = new Date();
        
        for (const evento of eventos) {
            try {
                const dataJogo = new Date(evento.time);
                const diffHoras = (dataJogo - agora) / (1000 * 60 * 60);
                
                if (diffHoras >= 0 && diffHoras <= 48) {
                    jogos.push({
                        id: evento.id,
                        horario: formatarHorario(dataJogo),
                        times: `${evento.home?.name || 'Time Casa'} × ${evento.away?.name || 'Time Visitante'}`,
                        campeonato: evento.league?.name || 'Campeonato',
                        dataReal: dataJogo
                    });
                }
            } catch (error) {
                continue;
            }
        }
        
        return jogos;
        
    } catch (error) {
        console.error('Erro ao buscar jogos:', error.message);
        throw error;
    }
}

// BUSCAR ODDS REAIS para um jogo específico
async function buscarOddsReais(eventoId) {
    const url = 'https://api.soccersapi.com/v2.2/eventodds/';
    const params = {
        user: SOCCERSAPI_USER,
        token: SOCCERSAPI_TOKEN,
        t: 'get',
        id: eventoId
    };
    
    try {
        const response = await axios.get(url, { 
            params, 
            timeout: 10000 
        });
        
        console.log(`📈 Analisando odds do evento ${eventoId}...`);
        
        if (response.data?.data?.odds) {
            const oddsData = response.data.data.odds;
            
            // Procurar por bookmakers
            for (const bookmakerId in oddsData) {
                const bookmaker = oddsData[bookmakerId];
                
                // Verificar se tem mercados Over/Under
                if (bookmaker.markets && bookmaker.markets['over_under']) {
                    const overUnder = bookmaker.markets['over_under'];
                    
                    // Extrair odds Over 0.5
                    let over05 = null;
                    if (overUnder['0.5'] && overUnder['0.5']['over']) {
                        over05 = parseFloat(overUnder['0.5']['over']);
                    }
                    
                    // Extrair odds Over 1.5
                    let over15 = null;
                    if (overUnder['1.5'] && overUnder['1.5']['over']) {
                        over15 = parseFloat(overUnder['1.5']['over']);
                    }
                    
                    // Se encontrou ambas as odds, retornar
                    if (over05 !== null && over15 !== null) {
                        console.log(`✅ Evento ${eventoId}: Over 0.5 = ${over05}, Over 1.5 = ${over15}`);
                        return { over05, over15 };
                    }
                }
            }
        }
        
        return null;
        
    } catch (error) {
        console.log(`⚠️ Não foi possível obter odds para evento ${eventoId}`);
        return null;
    }
}

// Tentar busca mínima (apenas verificar se API responde)
async function tentarBuscaMinima() {
    console.log('🔄 Tentando busca mínima na API...');
    
    try {
        // Testar se a API está acessível
        const testUrl = 'https://api.soccersapi.com/v2.2/leagues/';
        const testParams = {
            user: SOCCERSAPI_USER,
            token: SOCCERSAPI_TOKEN,
            t: 'list'
        };
        
        await axios.get(testUrl, { params: testParams, timeout: 10000 });
        console.log('✅ API está acessível, mas não retornou odds');
        
    } catch (error) {
        console.log('❌ API não está acessível');
    }
    
    // Retornar fallback mínimo
    return gerarFallbackMinimo();
}

// Processar resultados finais
function processarResultados(jogos) {
    // Over 0.5 (≥1.10)
    const over05 = jogos
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05);
    
    // Over 1.5 (≥1.50)
    const over15 = jogos
        .filter(j => j.oddsOver15 >= 1.50)
        .sort((a, b) => b.oddsOver15 - a.oddsOver15);
    
    return { over05, over15 };
}

// Gerar fallback mínimo (apenas se API falhar completamente)
function gerarFallbackMinimo() {
    const jogosMinimos = [
        {
            horario: '19:30',
            times: 'Chippa United × Kaizer Chiefs',
            campeonato: 'PSL África do Sul',
            oddsOver05: 1.14,
            oddsOver15: 1.62
        },
        {
            horario: '20:00',
            times: 'Exemplo 1 × Exemplo 2',
            campeonato: 'Campeonato Teste',
            oddsOver05: 1.12,
            oddsOver15: 1.58
        }
    ];
    
    return {
        over05: jogosMinimos.filter(j => j.oddsOver05 >= 1.10),
        over15: jogosMinimos.filter(j => j.oddsOver15 >= 1.50)
    };
}

// Funções auxiliares
function formatarData(data) {
    return data.toISOString().split('T')[0];
}

function formatarHorario(data) {
    return data.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Health check com verificação real da API
app.get('/health', async (req, res) => {
    try {
        // Testar conexão com SoccerAPI
        const testUrl = 'https://api.soccersapi.com/v2.2/leagues/';
        const testParams = {
            user: SOCCERSAPI_USER,
            token: SOCCERSAPI_TOKEN,
            t: 'list'
        };
        
        const apiResponse = await axios.get(testUrl, { 
            params: testParams, 
            timeout: 10000 
        });
        
        const apiStatus = apiResponse.data ? 'CONECTADA' : 'SEM DADOS';
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            soccersapi: apiStatus,
            user: SOCCERSAPI_USER ? 'CONFIGURADO' : 'NÃO CONFIGURADO',
            mensagem: 'Scanner Betano operacional'
        });
        
    } catch (error) {
        res.json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            soccersapi: 'OFFLINE',
            erro: error.message,
            mensagem: 'API SoccerAPI offline'
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n✅ Servidor rodando na porta ${PORT}`);
    console.log(`👉 Acesse: http://localhost:${PORT}`);
    console.log(`👉 Health: http://localhost:${PORT}/health`);
    console.log(`👉 API Jogos: http://localhost:${PORT}/api/jogos`);
    console.log('============================================');
});