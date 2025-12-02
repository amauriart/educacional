const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(express.json());
app.use(express.static('public'));

// SUAS CREDENCIAIS SOCCERSAPI
const SOCCERSAPI_USER = process.env.SOCCERSAPI_USER || '0x3YU';
const SOCCERSAPI_TOKEN = process.env.SOCCERSAPI_TOKEN || 'UVZnFqmGWH';

console.log('============================================');
console.log('🚀 SCANNER BETANO - SOCCERSAPI');
console.log('============================================');
console.log('🔑 Usando SoccerAPI (dados reais)');
console.log('👤 User:', SOCCERSAPI_USER);
console.log('🔐 Token:', SOCCERSAPI_TOKEN.substring(0, 6) + '...');
console.log('⏰ Filtro: Próximas 48 horas');
console.log('🎯 Mercados: Over 0.5 (≥1.10) e Over 1.5 (≥1.50)');
console.log('============================================');

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para buscar jogos REAIS
app.get('/api/jogos', async (req, res) => {
    try {
        console.log('\n🔄 BUSCANDO JOGOS REAIS VIA SOCCERSAPI...');
        const startTime = Date.now();
        
        const resultado = await buscarJogosSoccersAPI();
        const tempoTotal = Date.now() - startTime;
        
        console.log(`📊 Resultados: ${resultado.over05.length} Over 0.5 | ${resultado.over15.length} Over 1.5`);
        console.log(`⏱️ Tempo total: ${tempoTotal}ms`);
        
        res.json({
            over05: resultado.over05,
            over15: resultado.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            estatisticas: {
                over05: resultado.over05.length,
                over15: resultado.over15.length,
                tempoTotal: tempoTotal,
                totalJogos: resultado.totalJogos || 0,
                fonte: 'soccersapi'
            },
            sucesso: true,
            mensagem: `Dados reais obtidos em ${tempoTotal}ms`
        });
        
    } catch (error) {
        console.error('❌ ERRO NA API:', error.message);
        
        // Fallback inteligente
        const fallback = gerarFallbackInteligente();
        
        res.json({
            over05: fallback.over05,
            over15: fallback.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: `API SoccerAPI temporariamente indisponível. Dados simulados. Erro: ${error.message}`,
            estatisticas: {
                over05: fallback.over05.length,
                over15: fallback.over15.length,
                tempoTotal: 0,
                fonte: 'fallback'
            }
        });
    }
});

// Função principal para SoccerAPI
async function buscarJogosSoccersAPI() {
    const agora = new Date();
    const hoje = formatarData(agora);
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 2);
    const amanhaFormatado = formatarData(amanha);
    
    console.log(`📅 Período: ${hoje} até ${amanhaFormatado}`);
    
    // 1. Buscar eventos (jogos) do período
    const eventos = await buscarEventos(hoje, amanhaFormatado);
    console.log(`📊 ${eventos.length} eventos encontrados`);
    
    if (eventos.length === 0) {
        return { over05: [], over15: [], totalJogos: 0 };
    }
    
    // 2. Processar cada evento para buscar odds
    const jogosComOdds = [];
    
    for (const evento of eventos.slice(0, 50)) { // Limitar para não exceder rate limit
        try {
            const odds = await buscarOddsEvento(evento.id);
            
            if (odds && odds.over05 >= 1.10) { // Pelo menos Over 0.5 interessante
                const dataJogo = new Date(evento.time);
                const diffHoras = (dataJogo - agora) / (1000 * 60 * 60);
                
                // Filtrar próximas 48h
                if (diffHoras >= 0 && diffHoras <= 48) {
                    jogosComOdds.push({
                        horario: formatarHorario(dataJogo),
                        times: `${evento.home.name} × ${evento.away.name}`,
                        campeonato: evento.league.name,
                        oddsOver05: odds.over05,
                        oddsOver15: odds.over15,
                        dataJogo: dataJogo,
                        diffHoras: Math.round(diffHoras * 10) / 10
                    });
                }
            }
            
            // Delay para não exceder rate limit
            await delay(50);
            
        } catch (error) {
            console.log(`⚠️ Evento ${evento.id} ignorado: ${error.message}`);
            continue;
        }
    }
    
    console.log(`🎯 ${jogosComOdds.length} jogos com odds interessantes`);
    
    // 3. Ordenar resultados
    const over05 = jogosComOdds
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => {
            // Primeiro por odds mais altas
            if (b.oddsOver05 !== a.oddsOver05) {
                return b.oddsOver05 - a.oddsOver05;
            }
            // Depois por horário mais próximo
            return a.diffHoras - b.diffHoras;
        })
        .map(j => ({
            horario: j.horario,
            times: j.times,
            campeonato: j.campeonato,
            oddsOver05: j.oddsOver05
        }));
    
    const over15 = jogosComOdds
        .filter(j => j.oddsOver15 >= 1.50)
        .sort((a, b) => {
            if (b.oddsOver15 !== a.oddsOver15) {
                return b.oddsOver15 - a.oddsOver15;
            }
            return a.diffHoras - b.diffHoras;
        })
        .map(j => ({
            horario: j.horario,
            times: j.times,
            campeonato: j.campeonato,
            oddsOver15: j.oddsOver15
        }));
    
    return { 
        over05, 
        over15, 
        totalJogos: eventos.length 
    };
}

// Buscar eventos (jogos) por período
async function buscarEventos(dataInicio, dataFim) {
    const url = 'https://api.soccersapi.com/v2.2/events/';
    
    const params = {
        user: SOCCERSAPI_USER,
        token: SOCCERSAPI_TOKEN,
        t: 'schedule',
        from: dataInicio,
        to: dataFim,
        per_page: 100
    };
    
    console.log('🌐 Buscando eventos...');
    
    try {
        const response = await axios.get(url, { 
            params, 
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'BetanoScanner/1.0'
            }
        });
        
        if (response.data && response.data.data) {
            return response.data.data;
        }
        
        return [];
        
    } catch (error) {
        console.error('❌ Erro ao buscar eventos:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', error.response.data);
        }
        throw error;
    }
}

// Buscar odds de um evento específico
async function buscarOddsEvento(eventoId) {
    const url = `https://api.soccersapi.com/v2.2/eventodds/`;
    
    const params = {
        user: SOCCERSAPI_USER,
        token: SOCCERSAPI_TOKEN,
        t: 'get',
        id: eventoId
    };
    
    try {
        const response = await axios.get(url, { 
            params, 
            timeout: 15000 
        });
        
        if (response.data && response.data.data && response.data.data.odds) {
            const oddsData = response.data.data.odds;
            
            // Procurar por bookmaker "betano" (pode estar com nome diferente)
            let over05 = 1.00;
            let over15 = 1.00;
            
            // Verificar todos os bookmakers
            for (const bookmakerKey in oddsData) {
                const bookmaker = oddsData[bookmakerKey];
                
                // Verificar se é Betano (ou similar)
                if (bookmaker.name && 
                   (bookmaker.name.toLowerCase().includes('betano') || 
                    bookmaker.name.toLowerCase().includes('bet'))) {
                    
                    // Procurar mercado Over/Under
                    if (bookmaker.markets && bookmaker.markets['over_under']) {
                        const overUnder = bookmaker.markets['over_under'];
                        
                        // Procurar linha 0.5
                        if (overUnder['0.5'] && overUnder['0.5']['over']) {
                            over05 = parseFloat(overUnder['0.5']['over']) || 1.00;
                        }
                        
                        // Procurar linha 1.5
                        if (overUnder['1.5'] && overUnder['1.5']['over']) {
                            over15 = parseFloat(overUnder['1.5']['over']) || 1.00;
                        }
                        
                        // Se encontrou odds, retornar
                        if (over05 > 1.00 || over15 > 1.00) {
                            return { over05, over15 };
                        }
                    }
                }
            }
            
            // Se não encontrou Betano, usar primeiro bookmaker disponível
            const primeiroBookmaker = Object.values(oddsData)[0];
            if (primeiroBookmaker && primeiroBookmaker.markets && primeiroBookmaker.markets['over_under']) {
                const overUnder = primeiroBookmaker.markets['over_under'];
                
                if (overUnder['0.5'] && overUnder['0.5']['over']) {
                    over05 = parseFloat(overUnder['0.5']['over']) || 1.00;
                }
                
                if (overUnder['1.5'] && overUnder['1.5']['over']) {
                    over15 = parseFloat(overUnder['1.5']['over']) || 1.00;
                }
            }
            
            return { over05, over15 };
        }
        
        return { over05: 1.00, over15: 1.00 };
        
    } catch (error) {
        console.log(`⚠️ Não foi possível obter odds para evento ${eventoId}`);
        return { over05: 1.00, over15: 1.00 };
    }
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

// Fallback inteligente com horários dinâmicos
function gerarFallbackInteligente() {
    const agora = new Date();
    const horaAtual = agora.getHours();
    
    const jogosBase = [
        {
            times: 'Chippa United × Kaizer Chiefs',
            campeonato: 'PSL África do Sul',
            oddsOver05: 1.14,
            oddsOver15: 1.62
        },
        {
            times: 'Real Madrid × Barcelona',
            campeonato: 'La Liga',
            oddsOver05: 1.15,
            oddsOver15: 1.68
        },
        {
            times: 'Manchester City × Liverpool',
            campeonato: 'Premier League',
            oddsOver05: 1.12,
            oddsOver15: 1.58
        },
        {
            times: 'Bayern Munich × Borussia Dortmund',
            campeonato: 'Bundesliga',
            oddsOver05: 1.18,
            oddsOver15: 1.72
        },
        {
            times: 'PSG × Marseille',
            campeonato: 'Ligue 1',
            oddsOver05: 1.16,
            oddsOver15: 1.65
        },
        {
            times: 'Flamengo × Corinthians',
            campeonato: 'Brasileirão',
            oddsOver05: 1.13,
            oddsOver15: 1.55
        },
        {
            times: 'Ajax × PSV',
            campeonato: 'Eredivisie',
            oddsOver05: 1.19,
            oddsOver15: 1.75
        },
        {
            times: 'Benfica × Porto',
            campeonato: 'Primeira Liga',
            oddsOver05: 1.17,
            oddsOver15: 1.70
        }
    ];
    
    // Adicionar horários dinâmicos
    const jogosComHorario = jogosBase.map((jogo, index) => {
        const hora = (horaAtual + index + 1) % 24;
        const minuto = [0, 15, 30, 45][index % 4];
        return {
            ...jogo,
            horario: `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`
        };
    });
    
    return {
        over05: jogosComHorario
            .filter(j => j.oddsOver05 >= 1.10)
            .sort((a, b) => b.oddsOver05 - a.oddsOver05),
        over15: jogosComHorario
            .filter(j => j.oddsOver15 >= 1.50)
            .sort((a, b) => b.oddsOver15 - a.oddsOver15)
    };
}

app.listen(PORT, () => {
    console.log(`\n✅ SCANNER RODANDO NA PORTA ${PORT}`);
    console.log(`👉 Acesse: https://educacional.onrender.com`);
    console.log(`🔑 Credenciais configuradas: ${SOCCERSAPI_USER ? 'SIM' : 'NÃO'}`);
    console.log('============================================\n');
});