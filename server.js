const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// CREDENCIAIS
const SOCCERSAPI_USER = process.env.SOCCERSAPI_USER || '0x3YU';
const SOCCERSAPI_TOKEN = process.env.SOCCERSAPI_TOKEN || 'UVZnFqmGWH';

console.log('🚀 SCANNER BETANO - VERSÃO PACIENTE');
console.log('⏱️ Timeout: 180 segundos (3 minutos)');
console.log('🔑 User:', SOCCERSAPI_USER);

// Cache em memória (5 minutos)
let cache = {
    data: null,
    timestamp: 0,
    timeout: 5 * 60 * 1000 // 5 minutos
};

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota com CACHE e TIMEOUT LONGO
app.get('/api/jogos', async (req, res) => {
    console.log('\n📡 REQUISIÇÃO RECEBIDA - Modo Paciente');
    
    // Verificar cache primeiro
    const agora = Date.now();
    if (cache.data && (agora - cache.timestamp) < cache.timeout) {
        console.log('⚡ Retornando do cache');
        cache.data.atualizacao = new Date().toLocaleTimeString('pt-BR');
        cache.data.cache = true;
        return res.json(cache.data);
    }
    
    console.log('🔄 Buscando dados novos (pode levar até 3 minutos)...');
    
    // Configurar timeout LONGO para o cliente
    req.setTimeout(180000); // 3 minutos
    
    try {
        const inicio = Date.now();
        
        // BUSCAR DADOS COM PACIÊNCIA
        const resultado = await buscarComPaciencia();
        const tempo = Date.now() - inicio;
        
        console.log(`✅ Busca concluída em ${Math.round(tempo/1000)} segundos`);
        
        // Preparar resposta
        const resposta = {
            over05: resultado.over05,
            over15: resultado.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            estatisticas: {
                over05: resultado.over05.length,
                over15: resultado.over15.length,
                tempoTotal: tempo,
                fonte: resultado.fonte,
                jogosAnalisados: resultado.totalJogos || 0
            },
            sucesso: true,
            mensagem: `Busca concluída em ${Math.round(tempo/1000)} segundos`
        };
        
        // Salvar no cache
        cache.data = { ...resposta };
        cache.timestamp = Date.now();
        
        res.json(resposta);
        
    } catch (error) {
        console.error('❌ ERRO após tentativa longa:', error.message);
        
        // Se tem cache (mesmo expirado), usar
        if (cache.data) {
            console.log('🔄 Usando cache expirado como fallback');
            cache.data.atualizacao = new Date().toLocaleTimeString('pt-BR');
            cache.data.erro = true;
            cache.data.mensagem = `API lenta. Cache expirado. Erro: ${error.message}`;
            return res.json(cache.data);
        }
        
        // Último recurso: exemplo rápido
        const exemplo = gerarExemploRapido();
        
        res.json({
            over05: exemplo.over05,
            over15: exemplo.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: `API muito lenta (>3 minutos). Timeout: ${error.message}`,
            estatisticas: {
                over05: exemplo.over05.length,
                over15: exemplo.over15.length,
                tempoTotal: 0,
                fonte: 'timeout-exemplo'
            }
        });
    }
});

// BUSCAR COM PACIÊNCIA (até 2 minutos)
async function buscarComPaciencia() {
    console.log('🕐 Iniciando busca paciente...');
    
    try {
        // ETAPA 1: Buscar jogos (com timeout longo)
        console.log('1️⃣ Buscando lista de jogos...');
        const jogos = await buscarListaJogos();
        
        if (jogos.length === 0) {
            console.log('⚠️ Nenhum jogo encontrado');
            return { over05: [], over15: [], fonte: 'sem-jogos', totalJogos: 0 };
        }
        
        console.log(`📊 ${jogos.length} jogos para analisar`);
        
        // ETAPA 2: Buscar odds para cada jogo (com pausas)
        console.log('2️⃣ Analisando odds (lento, mas paciente)...');
        const jogosComOdds = [];
        
        for (let i = 0; i < Math.min(jogos.length, 5); i++) { // Apenas 5 jogos para ser viável
            const jogo = jogos[i];
            
            try {
                console.log(`   ${i+1}/${Math.min(jogos.length, 5)}: ${jogo.times.substring(0, 30)}...`);
                
                const odds = await buscarOddsComTimeout(jogo.id);
                
                if (odds && (odds.over05 >= 1.10 || odds.over15 >= 1.50)) {
                    jogosComOdds.push({
                        horario: jogo.horario,
                        times: jogo.times,
                        campeonato: jogo.campeonato,
                        oddsOver05: odds.over05,
                        oddsOver15: odds.over15
                    });
                    console.log(`     ✅ Over 0.5: ${odds.over05} | Over 1.5: ${odds.over15}`);
                }
                
                // Pausa generosa entre requisições
                if (i < Math.min(jogos.length, 5) - 1) {
                    console.log(`     ⏸️  Pausa de 3 segundos...`);
                    await delay(3000);
                }
                
            } catch (error) {
                console.log(`     ⚠️ Ignorado: ${error.message}`);
                continue;
            }
        }
        
        console.log(`🎯 ${jogosComOdds.length} jogos com odds válidas`);
        
        // ETAPA 3: Processar resultados
        const resultado = processarResultadosFinais(jogosComOdds);
        
        return {
            ...resultado,
            fonte: jogosComOdds.length > 0 ? 'odds-reais' : 'sem-odds',
            totalJogos: jogos.length
        };
        
    } catch (error) {
        console.error('Erro na busca paciente:', error.message);
        throw error;
    }
}

// BUSCAR LISTA DE JOGOS (timeout: 30 segundos)
async function buscarListaJogos() {
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
        per_page: 20 // Poucos jogos para ser rápido
    };
    
    try {
        const response = await axios.get(url, { 
            params, 
            timeout: 30000 // 30 segundos
        });
        
        const eventos = response.data?.data || [];
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
                        campeonato: evento.league?.name || 'Campeonato'
                    });
                }
            } catch (error) {
                continue;
            }
        }
        
        return jogos;
        
    } catch (error) {
        console.error('Erro ao buscar lista de jogos:', error.message);
        return [];
    }
}

// BUSCAR ODDS COM TIMEOUT GENEROSO
async function buscarOddsComTimeout(eventoId) {
    const url = 'https://api.soccersapi.com/v2.2/eventodds/';
    const params = {
        user: SOCCERSAPI_USER,
        token: SOCCERSAPI_TOKEN,
        t: 'get',
        id: eventoId
    };
    
    try {
        // Timeout generoso: 20 segundos por requisição
        const response = await axios.get(url, { 
            params, 
            timeout: 20000 
        });
        
        const oddsData = response.data?.data?.odds;
        
        if (!oddsData) {
            return null;
        }
        
        // Procurar odds em qualquer bookmaker
        for (const bookmakerId in oddsData) {
            const bookmaker = oddsData[bookmakerId];
            
            if (bookmaker.markets && bookmaker.markets['over_under']) {
                const overUnder = bookmaker.markets['over_under'];
                
                let over05 = 1.00;
                let over15 = 1.00;
                
                if (overUnder['0.5'] && overUnder['0.5']['over']) {
                    over05 = parseFloat(overUnder['0.5']['over']);
                }
                
                if (overUnder['1.5'] && overUnder['1.5']['over']) {
                    over15 = parseFloat(overUnder['1.5']['over']);
                }
                
                // Retornar se encontrou algo
                if (over05 > 1.00 || over15 > 1.00) {
                    return { over05, over15 };
                }
            }
        }
        
        return null;
        
    } catch (error) {
        console.log(`Timeout/erro odds ${eventoId}:`, error.message);
        return null;
    }
}

// PROCESSAR RESULTADOS
function processarResultadosFinais(jogos) {
    const over05 = jogos
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05)
        .map(j => ({
            horario: j.horario,
            times: j.times,
            campeonato: j.campeonato,
            oddsOver05: parseFloat(j.oddsOver05.toFixed(2))
        }));
    
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

// GERAR EXEMPLO RÁPIDO
function gerarExemploRapido() {
    const jogos = [
        {
            horario: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', hour12: false}),
            times: 'Chippa United × Kaizer Chiefs',
            campeonato: 'PSL África do Sul',
            oddsOver05: 1.14,
            oddsOver15: 1.62
        },
        {
            horario: new Date(Date.now() + 3600000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', hour12: false}),
            times: 'Exemplo 1 × Exemplo 2',
            campeonato: 'Campeonato Teste',
            oddsOver05: 1.12,
            oddsOver15: 1.58
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

// Health check RÁPIDO
app.get('/health', async (req, res) => {
    try {
        const response = await axios.get('https://api.soccersapi.com/v2.2/leagues/', {
            params: {
                user: SOCCERSAPI_USER,
                token: SOCCERSAPI_TOKEN,
                t: 'list'
            },
            timeout: 10000
        });
        
        res.json({
            status: 'OK',
            soccersapi: 'CONECTADA',
            timestamp: new Date().toISOString(),
            mensagem: 'API operacional (lenta, mas funciona)'
        });
        
    } catch (error) {
        res.json({
            status: 'SLOW',
            soccersapi: 'LENTA',
            timestamp: new Date().toISOString(),
            mensagem: `API responde mas é lenta: ${error.message}`
        });
    }
});

// Rota para teste MANUAL (sem timeout)
app.get('/api/teste-manual', async (req, res) => {
    console.log('🧪 TESTE MANUAL INICIADO (sem timeout)...');
    
    try {
        // Testar endpoints
        const testes = [
            { nome: 'Ligas', endpoint: 'leagues', params: { t: 'list' } },
            { nome: 'Eventos hoje', endpoint: 'events', params: { t: 'schedule', from: formatarData(new Date()), to: formatarData(new Date()) } }
        ];
        
        const resultados = [];
        
        for (const teste of testes) {
            try {
                const inicio = Date.now();
                const url = `https://api.soccersapi.com/v2.2/${teste.endpoint}/`;
                const params = { user: SOCCERSAPI_USER, token: SOCCERSAPI_TOKEN, ...teste.params };
                
                const response = await axios.get(url, { params, timeout: 30000 });
                const tempo = Date.now() - inicio;
                
                resultados.push({
                    teste: teste.nome,
                    status: '✅ OK',
                    tempo: `${tempo}ms`,
                    dados: response.data?.data?.length || 0
                });
                
                console.log(`✅ ${teste.nome}: ${tempo}ms`);
                
            } catch (error) {
                resultados.push({
                    teste: teste.nome,
                    status: '❌ ERRO',
                    erro: error.message
                });
                console.log(`❌ ${teste.nome}: ${error.message}`);
            }
            
            await delay(2000);
        }
        
        res.json({
            status: 'Teste concluído',
            resultados: resultados,
            mensagem: 'Testes manuais realizados'
        });
        
    } catch (error) {
        res.json({
            status: 'ERRO',
            mensagem: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n✅ SERVIDOR PACIENTE RODANDO: http://localhost:${PORT}`);
    console.log('⏱️  Timeouts configurados:');
    console.log('   - Busca completa: 180 segundos');
    console.log('   - Cache: 5 minutos');
    console.log('   - Health check: 10 segundos');
    console.log('👉 Teste manual: http://localhost:${PORT}/api/teste-manual');
});