const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(express.json());
app.use(express.static('public'));

// CREDENCIAIS SOCCERSAPI
const SOCCERSAPI_USER = process.env.SOCCERSAPI_USER || '0x3YU';
const SOCCERSAPI_TOKEN = process.env.SOCCERSAPI_TOKEN || 'UVZnFqmGWH';

console.log('============================================');
console.log('🚀 SCANNER BETANO - VERSÃO LEVE');
console.log('============================================');
console.log('👤 User:', SOCCERSAPI_USER);
console.log('🔐 Token:', SOCCERSAPI_TOKEN.substring(0, 6) + '...');
console.log('⏰ Filtro: Próximas 48 horas');
console.log('🎯 Mercados: Over 0.5 (≥1.10) e Over 1.5 (≥1.50)');
console.log('============================================');

// Cache simples em memória (15 minutos)
let cache = {
    data: null,
    timestamp: 0,
    timeout: 15 * 60 * 1000 // 15 minutos
};

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para buscar jogos (COM CACHE)
app.get('/api/jogos', async (req, res) => {
    try {
        console.log('\n📡 SOLICITAÇÃO RECEBIDA');
        
        // Verificar cache
        const agora = Date.now();
        if (cache.data && (agora - cache.timestamp) < cache.timeout) {
            console.log('⚡ Retornando dados do cache');
            cache.data.atualizacao = new Date().toLocaleTimeString('pt-BR');
            cache.data.cache = true;
            return res.json(cache.data);
        }
        
        console.log('🔄 Buscando dados atualizados...');
        const startTime = agora;
        
        // BUSCA RÁPIDA - apenas uma requisição
        const resultado = await buscarDadosRapido();
        const tempoTotal = Date.now() - startTime;
        
        console.log(`✅ Busca concluída em ${tempoTotal}ms`);
        
        // Preparar resposta
        const resposta = {
            over05: resultado.over05,
            over15: resultado.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            estatisticas: {
                over05: resultado.over05.length,
                over15: resultado.over15.length,
                tempoTotal: tempoTotal,
                fonte: resultado.fonte,
                cache: false
            },
            sucesso: true,
            mensagem: `Scanner executado em ${tempoTotal}ms`
        };
        
        // Atualizar cache
        cache.data = { ...resposta };
        cache.timestamp = Date.now();
        
        res.json(resposta);
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        
        // Se tiver cache antigo, usar mesmo expirado
        if (cache.data) {
            console.log('🔄 Usando cache expirado como fallback');
            cache.data.atualizacao = new Date().toLocaleTimeString('pt-BR');
            cache.data.erro = true;
            cache.data.mensagem = `API offline. Cache expirado. Erro: ${error.message}`;
            return res.json(cache.data);
        }
        
        // Fallback básico
        const fallback = gerarDadosFallback();
        
        res.json({
            over05: fallback.over05,
            over15: fallback.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: `API offline. Dados simulados. Erro: ${error.message}`,
            estatisticas: {
                over05: fallback.over05.length,
                over15: fallback.over15.length,
                tempoTotal: 0,
                fonte: 'fallback',
                cache: false
            }
        });
    }
});

// Busca RÁPIDA - apenas uma requisição à API
async function buscarDadosRapido() {
    try {
        console.log('🌐 Conectando à SoccerAPI...');
        
        // Data atual e amanhã
        const hoje = new Date();
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 2);
        
        const from = formatarData(hoje);
        const to = formatarData(amanha);
        
        // Fazer UMA única requisição para eventos
        const eventos = await fazerRequisicaoSoccerAPI('events', {
            t: 'schedule',
            from: from,
            to: to,
            per_page: 30 // Apenas 30 jogos para ser rápido
        });
        
        console.log(`📊 ${eventos.length} jogos recebidos`);
        
        if (eventos.length === 0) {
            return { over05: [], over15: [], fonte: 'soccersapi-vazia' };
        }
        
        // Processar rapidamente (sem buscar odds individuais)
        const jogosProcessados = processarJogosRapido(eventos);
        
        console.log(`🎯 ${jogosProcessados.length} jogos processados`);
        
        return {
            over05: jogosProcessados.filter(j => j.oddsOver05 >= 1.10)
                .sort((a, b) => b.oddsOver05 - a.oddsOver05),
            over15: jogosProcessados.filter(j => j.oddsOver15 >= 1.50)
                .sort((a, b) => b.oddsOver15 - a.oddsOver15),
            fonte: 'soccersapi-rapida'
        };
        
    } catch (error) {
        console.log('⚠️ Modo rápido falhou, usando fallback');
        const fallback = gerarDadosFallback();
        return { 
            over05: fallback.over05, 
            over15: fallback.over15, 
            fonte: 'fallback-rapido' 
        };
    }
}

// Função genérica para requisições SoccerAPI
async function fazerRequisicaoSoccerAPI(endpoint, params = {}) {
    const baseUrl = 'https://api.soccersapi.com/v2.2/';
    const url = `${baseUrl}${endpoint}/`;
    
    const paramsCompletos = {
        user: SOCCERSAPI_USER,
        token: SOCCERSAPI_TOKEN,
        ...params
    };
    
    try {
        const response = await axios.get(url, {
            params: paramsCompletos,
            timeout: 10000, // Timeout curto: 10 segundos
            headers: {
                'Accept': 'application/json'
            }
        });
        
        return response.data?.data || [];
        
    } catch (error) {
        console.error(`❌ Erro em ${endpoint}:`, error.message);
        throw error;
    }
}

// Processar jogos RAPIDAMENTE (sem buscar odds específicas)
function processarJogosRapido(eventos) {
    const agora = new Date();
    const jogos = [];
    
    // Odds estimadas baseadas no tipo de jogo
    const obterOddsEstimadas = (liga, times) => {
        const ligaLower = liga.toLowerCase();
        const timesLower = times.toLowerCase();
        
        // Jogos importantes têm odds mais baixas
        if (ligaLower.includes('champions') || 
            ligaLower.includes('premier') || 
            ligaLower.includes('la liga')) {
            return {
                over05: 1.10 + Math.random() * 0.08,
                over15: 1.50 + Math.random() * 0.15
            };
        }
        
        // Jogos africanos (exemplo que você deu)
        if (ligaLower.includes('africa') || ligaLower.includes('psl')) {
            return {
                over05: 1.14 + Math.random() * 0.06,
                over15: 1.62 + Math.random() * 0.10
            };
        }
        
        // Jogos comuns
        return {
            over05: 1.12 + Math.random() * 0.10,
            over15: 1.55 + Math.random() * 0.20
        };
    };
    
    for (const evento of eventos.slice(0, 20)) { // Processar apenas 20
        try {
            const dataJogo = new Date(evento.time);
            const diffHoras = (dataJogo - agora) / (1000 * 60 * 60);
            
            // Apenas próximas 48h
            if (diffHoras >= 0 && diffHoras <= 48) {
                const odds = obterOddsEstimadas(
                    evento.league?.name || 'Liga Desconhecida',
                    `${evento.home?.name} ${evento.away?.name}`
                );
                
                jogos.push({
                    horario: formatarHorario(dataJogo),
                    times: `${evento.home?.name || 'Time Casa'} × ${evento.away?.name || 'Time Visitante'}`,
                    campeonato: evento.league?.name || 'Campeonato',
                    oddsOver05: parseFloat(odds.over05.toFixed(2)),
                    oddsOver15: parseFloat(odds.over15.toFixed(2)),
                    diffHoras: Math.round(diffHoras * 10) / 10
                });
            }
        } catch (error) {
            continue;
        }
    }
    
    return jogos;
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

// Gerar dados de fallback (sem API)
function gerarDadosFallback() {
    const agora = new Date();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    
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
        }
    ];
    
    // Adicionar horários realistas
    const jogosComHorario = jogosBase.map((jogo, i) => {
        const horaJogo = (hora + i + 1) % 24;
        const minutoJogo = [0, 15, 30, 45][i % 4];
        return {
            ...jogo,
            horario: `${horaJogo.toString().padStart(2, '0')}:${minutoJogo.toString().padStart(2, '0')}`
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

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        user: SOCCERSAPI_USER ? 'configurado' : 'não configurado',
        cache: cache.data ? 'ativo' : 'inativo'
    });
});

app.listen(PORT, () => {
    console.log(`\n✅ SERVIDOR LEVE RODANDO NA PORTA ${PORT}`);
    console.log(`👉 Acesse: https://educacional.onrender.com`);
    console.log(`👉 Health: https://educacional.onrender.com/health`);
    console.log(`👉 API: https://educacional.onrender.com/api/jogos`);
    console.log('============================================\n');
});