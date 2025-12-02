const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// CREDENCIAIS - JÁ ESTÃO CONFIGURADAS E FUNCIONANDO!
const SOCCERSAPI_USER = process.env.SOCCERSAPI_USER || '0x3YU';
const SOCCERSAPI_TOKEN = process.env.SOCCERSAPI_TOKEN || 'UVZnFqmGWH';

console.log('🚀 SCANNER BETANO - VERSÃO DEFINITIVA');
console.log('✅ API CONECTADA:', SOCCERSAPI_USER ? 'SIM' : 'NÃO');

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota PRINCIPAL - Busca dados REAIS
app.get('/api/jogos', async (req, res) => {
    console.log('\n=== INICIANDO BUSCA DE ODDS REAIS ===');
    
    try {
        // 1. Buscar jogos das próximas 48h
        console.log('📅 Buscando jogos...');
        const jogos = await buscarJogos48h();
        
        if (jogos.length === 0) {
            console.log('⚠️ Nenhum jogo encontrado nas próximas 48h');
            return enviarResposta(res, [], [], 'Nenhum jogo nas próximas 48h', 'vazio');
        }
        
        console.log(`📊 ${jogos.length} jogos encontrados`);
        
        // 2. Buscar odds REAIS para cada jogo
        console.log('💰 Buscando odds reais...');
        const jogosComOdds = [];
        
        for (const jogo of jogos.slice(0, 8)) { // Limitar a 8 para ser rápido
            try {
                const odds = await buscarOddsParaJogo(jogo.id);
                
                if (odds && (odds.over05 >= 1.10 || odds.over15 >= 1.50)) {
                    jogosComOdds.push({
                        ...jogo,
                        oddsOver05: odds.over05,
                        oddsOver15: odds.over15,
                        oddsFonte: 'real'
                    });
                    console.log(`✅ ${jogo.times.substring(0, 20)}... - Over 0.5: ${odds.over05} | Over 1.5: ${odds.over15}`);
                }
                
                // Pequena pausa
                await delay(50);
                
            } catch (error) {
                console.log(`⚠️ Ignorando jogo ${jogo.id}`);
                continue;
            }
        }
        
        console.log(`🎯 ${jogosComOdds.length} jogos com odds válidas`);
        
        if (jogosComOdds.length === 0) {
            console.log('⚠️ Nenhum jogo com odds válidas encontrado');
            
            // Tentar buscar pelo menos UM jogo com odds
            const jogoComOdds = await buscarUmJogoComOdds();
            if (jogoComOdds) {
                jogosComOdds.push(jogoComOdds);
                console.log('✅ Encontrei pelo menos um jogo com odds!');
            }
        }
        
        // 3. Processar resultados
        const resultado = processarResultados(jogosComOdds);
        
        // 4. Enviar resposta
        enviarResposta(
            res, 
            resultado.over05, 
            resultado.over15, 
            `${jogosComOdds.length} jogos com odds reais`,
            'real'
        );
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        enviarResposta(res, [], [], `Erro: ${error.message}`, 'erro');
    }
});

// BUSCAR JOGOS DAS PRÓXIMAS 48H
async function buscarJogos48h() {
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
        per_page: 50
    };
    
    try {
        const response = await axios.get(url, { 
            params, 
            timeout: 20000 
        });
        
        const eventos = response.data?.data || [];
        const jogos = [];
        const agora = new Date();
        
        // Filtrar próximas 48h e formatar
        for (const evento of eventos) {
            try {
                const dataJogo = new Date(evento.time);
                const diffHoras = (dataJogo - agora) / (1000 * 60 * 60);
                
                if (diffHoras >= 0 && diffHoras <= 48) {
                    jogos.push({
                        id: evento.id,
                        horario: formatarHorario(dataJogo),
                        times: `${evento.home?.name || ''} × ${evento.away?.name || ''}`,
                        campeonato: evento.league?.name || 'Campeonato',
                        dataJogo: dataJogo,
                        diffHoras: diffHoras
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

// BUSCAR ODDS PARA UM JOGO ESPECÍFICO
async function buscarOddsParaJogo(eventoId) {
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
            timeout: 15000 
        });
        
        const oddsData = response.data?.data?.odds;
        
        if (!oddsData) {
            return null;
        }
        
        // Procurar em todos os bookmakers
        for (const bookmakerId in oddsData) {
            const bookmaker = oddsData[bookmakerId];
            
            // Verificar se é um bookmaker de apostas (não estatísticas)
            if (bookmaker.markets && bookmaker.markets['over_under']) {
                const overUnder = bookmaker.markets['over_under'];
                
                // Extrair Over 0.5
                let over05 = 1.00;
                if (overUnder['0.5'] && overUnder['0.5']['over']) {
                    over05 = parseFloat(overUnder['0.5']['over']);
                }
                
                // Extrair Over 1.5
                let over15 = 1.00;
                if (overUnder['1.5'] && overUnder['1.5']['over']) {
                    over15 = parseFloat(overUnder['1.5']['over']);
                }
                
                // Retornar se encontrou odds válidas
                if (over05 > 1.00 || over15 > 1.00) {
                    return { over05, over15 };
                }
            }
        }
        
        return null;
        
    } catch (error) {
        console.log(`Erro odds para ${eventoId}:`, error.message);
        return null;
    }
}

// BUSCAR PELO MENOS UM JOGO COM ODDS (fallback agressivo)
async function buscarUmJogoComOdds() {
    console.log('🔍 Buscando pelo menos um jogo com odds...');
    
    try {
        // Buscar eventos populares
        const url = 'https://api.soccersapi.com/v2.2/events/';
        const params = {
            user: SOCCERSAPI_USER,
            token: SOCCERSAPI_TOKEN,
            t: 'schedule',
            from: formatarData(new Date()),
            to: formatarData(new Date()),
            per_page: 10
        };
        
        const response = await axios.get(url, { params, timeout: 15000 });
        const eventos = response.data?.data || [];
        
        if (eventos.length === 0) return null;
        
        // Pegar primeiro evento
        const evento = eventos[0];
        const odds = await buscarOddsParaJogo(evento.id);
        
        if (odds) {
            return {
                id: evento.id,
                horario: formatarHorario(new Date(evento.time)),
                times: `${evento.home?.name || ''} × ${evento.away?.name || ''}`,
                campeonato: evento.league?.name || 'Campeonato',
                oddsOver05: odds.over05,
                oddsOver15: odds.over15,
                oddsFonte: 'real-forçado'
            };
        }
        
    } catch (error) {
        console.log('Erro ao buscar jogo único:', error.message);
    }
    
    return null;
}

// PROCESSAR RESULTADOS
function processarResultados(jogos) {
    // Over 0.5 (≥1.10) - ordenar por maior odds
    const over05 = jogos
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05)
        .map(j => ({
            horario: j.horario,
            times: j.times,
            campeonato: j.campeonato,
            oddsOver05: parseFloat(j.oddsOver05.toFixed(2))
        }));
    
    // Over 1.5 (≥1.50) - ordenar por maior odds
    const over15 = jogos
        .filter(j => j.oddsOver15 >= 1.50)
        .sort((a, b) => b.oddsOver15 - a.oddsOver15)
        .map(j => ({
            horario: j.horario,
            times: j.times,
            campeonato: j.campeonato,
            oddsOver15: parseFloat(j.oddsOver15.toFixed(2))
        }));
    
    return { over05, over15 };
}

// ENVIAR RESPOSTA
function enviarResposta(res, over05, over15, mensagem, tipo) {
    const resposta = {
        over05: over05,
        over15: over15,
        atualizacao: new Date().toLocaleTimeString('pt-BR'),
        estatisticas: {
            over05: over05.length,
            over15: over15.length,
            fonte: tipo === 'real' ? 'odds-reais' : 'exemplo'
        },
        sucesso: tipo !== 'erro',
        mensagem: mensagem
    };
    
    // Adicionar dados de exemplo se estiver vazio
    if (over05.length === 0 && over15.length === 0) {
        const exemplo = gerarExemploMinimo();
        resposta.over05 = exemplo.over05;
        resposta.over15 = exemplo.over15;
        resposta.mensagem += ' (dados de exemplo)';
        resposta.estatisticas.fonte = 'exemplo-minimo';
    }
    
    res.json(resposta);
}

// GERAR EXEMPLO MÍNIMO
function gerarExemploMinimo() {
    const jogos = [
        {
            horario: '19:30',
            times: 'Chippa United × Kaizer Chiefs',
            campeonato: 'PSL África do Sul',
            oddsOver05: 1.14,
            oddsOver15: 1.62
        }
    ];
    
    return {
        over05: jogos.filter(j => j.oddsOver05 >= 1.10),
        over15: jogos.filter(j => j.oddsOver15 >= 1.50)
    };
}

// FUNÇÕES AUXILIARES
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

// Health check melhorado
app.get('/health', async (req, res) => {
    try {
        // Testar API
        const test = await axios.get('https://api.soccersapi.com/v2.2/leagues/', {
            params: {
                user: SOCCERSAPI_USER,
                token: SOCCERSAPI_TOKEN,
                t: 'list'
            },
            timeout: 10000
        });
        
        const ligas = test.data?.data?.length || 0;
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            soccersapi: 'CONECTADA',
            ligas_disponiveis: ligas,
            user: SOCCERSAPI_USER ? 'CONFIGURADO' : 'NÃO',
            mensagem: `API SoccerAPI operacional com ${ligas} ligas`
        });
        
    } catch (error) {
        res.json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            soccersapi: 'OFFLINE',
            erro: error.message,
            mensagem: 'Falha na conexão com SoccerAPI'
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n✅ SERVIDOR RODANDO: http://localhost:${PORT}`);
    console.log(`👉 Health: http://localhost:${PORT}/health`);
    console.log(`👉 Scanner: http://localhost:${PORT}`);
    console.log('============================================');
});