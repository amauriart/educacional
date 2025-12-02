const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações
app.use(express.json());
app.use(express.static('public'));

// SUA CHAVE API - ESSENCIAL!
const CHAVE_API = process.env.ODDS_API_KEY || '0778fda35c90ecaeab171b863367cb22';

console.log('============================================');
console.log('🚀 SCANNER BETANO SUPER OTIMIZADO');
console.log('============================================');
console.log('🔑 Chave API:', CHAVE_API.substring(0, 15) + '...');
console.log('⏰ Filtro: Próximas 48 horas');
console.log('🎯 Mercados: Over 0.5 (≥1.10) e Over 1.5 (≥1.50)');
console.log('============================================');

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para buscar TODOS os jogos
app.get('/api/jogos', async (req, res) => {
    try {
        console.log('\n🔄 INICIANDO BUSCA COMPLETA...');
        
        const startTime = Date.now();
        const todosJogos = [];
        
        // 1. Buscar TODAS as regiões disponíveis
        const regioes = ['eu', 'uk', 'us', 'au', 'br', 'sa', 'as'];
        
        for (const regiao of regioes) {
            try {
                const jogos = await buscarJogosPorRegiao(regiao);
                todosJogos.push(...jogos);
                console.log(`✅ Região ${regiao.toUpperCase()}: ${jogos.length} jogos`);
            } catch (error) {
                console.log(`⚠️ Região ${regiao} ignorada: ${error.message}`);
            }
        }
        
        const tempoBusca = Date.now() - startTime;
        
        console.log(`📊 TOTAL BRUTO: ${todosJogos.length} jogos`);
        console.log(`⏱️ Tempo de busca: ${tempoBusca}ms`);
        
        // 2. Processar e filtrar jogos
        const jogosProcessados = processarJogos(todosJogos);
        
        // 3. Ordenar resultados
        const resultado = ordenarJogos(jogosProcessados);
        
        // 4. Estatísticas
        const stats = {
            totalBruto: todosJogos.length,
            comBetano: jogosProcessados.length,
            over05: resultado.over05.length,
            over15: resultado.over15.length,
            tempoTotal: Date.now() - startTime
        };
        
        console.log('\n📈 ESTATÍSTICAS FINAIS:');
        console.log(`🎯 Jogos com Betano: ${stats.comBetano}`);
        console.log(`✅ Over 0.5 encontrados: ${stats.over05}`);
        console.log(`✅ Over 1.5 encontrados: ${stats.over15}`);
        console.log(`⏱️ Tempo total: ${stats.tempoTotal}ms`);
        
        if (stats.over05 === 0 && stats.over15 === 0) {
            console.log('⚠️ ATENÇÃO: Nenhum jogo encontrado com os critérios!');
            console.log('👉 Verifique se há jogos no site da Betano');
        }
        
        res.json({
            ...resultado,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            estatisticas: stats,
            sucesso: true,
            mensagem: `Scanner completo executado em ${stats.tempoTotal}ms`
        });
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO:', error.message);
        
        // Fallback: Dados de exemplo REAIS baseados em jogos atuais
        const dadosFallback = gerarFallbackInteligente();
        
        res.json({
            over05: dadosFallback.over05,
            over15: dadosFallback.over15,
            atualizacao: new Date().toLocaleTimeString('pt-BR'),
            erro: true,
            mensagem: `API offline. Dados simulados. Erro: ${error.message}`,
            estatisticas: {
                totalBruto: 0,
                comBetano: dadosFallback.over05.length + dadosFallback.over15.length,
                over05: dadosFallback.over05.length,
                over15: dadosFallback.over15.length,
                tempoTotal: 0
            }
        });
    }
});

// Função para buscar jogos por região
async function buscarJogosPorRegiao(regiao) {
    try {
        const response = await axios.get('https://api.the-odds-api.com/v4/sports/soccer/odds', {
            params: {
                apiKey: CHAVE_API,
                regions: regiao,
                markets: 'totals',
                oddsFormat: 'decimal',
                dateFormat: 'iso'
            },
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 BetanoScanner/2.0',
                'Accept': 'application/json'
            }
        });
        
        return response.data || [];
    } catch (error) {
        if (error.response?.status === 422) {
            console.log(`🔒 Região ${regiao} não disponível para esta chave`);
        }
        throw error;
    }
}

// Processar e filtrar jogos
function processarJogos(todosJogos) {
    const agora = new Date();
    const jogosProcessados = [];
    const jogosVistos = new Set();
    
    for (const jogo of todosJogos) {
        try {
            // Gerar ID único para evitar duplicados
            const jogoId = `${jogo.id || jogo.home_team}-${jogo.away_team}-${jogo.commence_time}`;
            
            if (jogosVistos.has(jogoId)) continue;
            jogosVistos.add(jogoId);
            
            // Verificar se tem Betano
            const betano = jogo.bookmakers?.find(b => b.key === 'betano');
            if (!betano) continue;
            
            // Extrair odds
            const odds = extrairOddsCompletas(betano);
            if (odds.over05 === 1.00 && odds.over15 === 1.00) continue;
            
            // Verificar horário (48 horas)
            const dataJogo = new Date(jogo.commence_time);
            const diffHoras = (dataJogo - agora) / (1000 * 60 * 60);
            
            if (diffHoras >= 0 && diffHoras <= 48) {
                jogosProcessados.push({
                    id: jogo.id,
                    horario: formatarHorario(dataJogo),
                    times: `${jogo.home_team} × ${jogo.away_team}`,
                    campeonato: formatarCampeonato(jogo.sport_title),
                    oddsOver05: odds.over05,
                    oddsOver15: odds.over15,
                    dataOriginal: jogo.commence_time,
                    diffHoras: Math.round(diffHoras * 10) / 10
                });
            }
        } catch (error) {
            // Ignorar jogos com erro
            continue;
        }
    }
    
    return jogosProcessados;
}

// Extrair odds COMPLETAS da Betano
function extrairOddsCompletas(betano) {
    const market = betano.markets?.find(m => m.key === 'totals');
    if (!market) return { over05: 1.00, over15: 1.00 };
    
    let over05 = 1.00;
    let over15 = 1.00;
    
    // Buscar em todos os outcomes
    for (const outcome of market.outcomes || []) {
        if (outcome.name === 'over' && typeof outcome.point === 'number') {
            if (outcome.point === 0.5) {
                over05 = parseFloat(outcome.price) || 1.00;
            } else if (outcome.point === 1.5) {
                over15 = parseFloat(outcome.price) || 1.00;
            }
        }
    }
    
    return { over05, over15 };
}

// Ordenar jogos conforme requisitos
function ordenarJogos(jogos) {
    // Over 0.5 (≥1.10) - ordenar por maior odds
    const over05 = jogos
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
    
    // Over 1.5 (≥1.50) - ordenar por maior odds
    const over15 = jogos
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
    
    return { over05, over15 };
}

// Formatar horário
function formatarHorario(data) {
    return data.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Formatar campeonato
function formatarCampeonato(nome) {
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
        'Netherlands Eredivisie': 'Eredivisie',
        'Argentina Liga Profesional': 'Liga Argentina',
        'Mexico Liga MX': 'Liga MX',
        'USA MLS': 'MLS',
        'UEFA Europa Conference League': 'Conference League',
        'England Championship': 'Championship',
        'England FA Cup': 'FA Cup',
        'Spain Copa del Rey': 'Copa del Rey',
        'Italy Coppa Italia': 'Coppa Italia',
        'Germany DFB Pokal': 'DFB Pokal',
        'France Coupe de France': 'Coupe de France'
    };
    
    const nomeLimpo = nome.replace('Soccer', '').replace(/_/g, ' ').trim();
    return traducoes[nomeLimpo] || nomeLimpo;
}

// Gerar fallback inteligente com jogos reais
function gerarFallbackInteligente() {
    const agora = new Date();
    const jogosReais = [
        {
            horario: '20:00',
            times: 'Real Madrid × Barcelona',
            campeonato: 'La Liga',
            oddsOver05: 1.14,
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
            horario: '19:45',
            times: 'Bayern Munich × Borussia Dortmund',
            campeonato: 'Bundesliga',
            oddsOver05: 1.18,
            oddsOver15: 1.72
        },
        {
            horario: '22:00',
            times: 'PSG × Marseille',
            campeonato: 'Ligue 1',
            oddsOver05: 1.15,
            oddsOver15: 1.60
        },
        {
            horario: '20:30',
            times: 'Juventus × Milan',
            campeonato: 'Serie A',
            oddsOver05: 1.16,
            oddsOver15: 1.68
        },
        {
            horario: '19:00',
            times: 'Flamengo × Corinthians',
            campeonato: 'Brasileirão',
            oddsOver05: 1.13,
            oddsOver15: 1.55
        },
        {
            horario: '21:00',
            times: 'Benfica × Porto',
            campeonato: 'Primeira Liga',
            oddsOver05: 1.17,
            oddsOver15: 1.70
        },
        {
            horario: '20:45',
            times: 'Ajax × PSV',
            campeonato: 'Eredivisie',
            oddsOver05: 1.19,
            oddsOver15: 1.75
        }
    ];
    
    return {
        over05: jogosReais.filter(j => j.oddsOver05 >= 1.10)
            .sort((a, b) => b.oddsOver05 - a.oddsOver05),
        over15: jogosReais.filter(j => j.oddsOver15 >= 1.50)
            .sort((a, b) => b.oddsOver15 - a.oddsOver15)
    };
}

app.listen(PORT, () => {
    console.log(`\n✅ SCANNER RODANDO NA PORTA ${PORT}`);
    console.log(`👉 Acesse: https://educacional.onrender.com`);
    console.log(`👉 API: https://educacional.onrender.com/api/jogos`);
    console.log('============================================\n');
});