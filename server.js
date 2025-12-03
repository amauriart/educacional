const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações da API (The Odds API)
const API_CONFIG = {
  // Chave de API fornecida pelo usuário
  apiKey: '0778fda35c90ecaeab171b863367cb22',
  baseUrl: 'https://api.the-odds-api.com/v4/sports',
  sportKey: 'soccer_epl', // Usando EPL como exemplo, pode ser ajustado para 'soccer' se o plano permitir
  bookmakerKey: 'betsson', // Bookmaker escolhido
  marketKey: 'totals', // Mercado Over/Under
  regions: 'eu',
  oddsFormat: 'decimal'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Função para buscar fixtures com odds da The Odds API
async function fetchFixturesWithOdds() {
  try {
    // A The Odds API já filtra por jogos futuros
    const url = `${API_CONFIG.baseUrl}/${API_CONFIG.sportKey}/odds/?apiKey=${API_CONFIG.apiKey}&regions=${API_CONFIG.regions}&markets=${API_CONFIG.marketKey}&oddsFormat=${API_CONFIG.oddsFormat}`;
    
    console.log('Fetching from:', url);
    const response = await fetch(url);
    const data = await response.json();
    
    // A The Odds API retorna um array de jogos diretamente
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao buscar fixtures:', error);
    return [];
  }
}

// Função para processar e filtrar odds
function processMatches(matches) {
  const results = {
    over05: [],
    over15: []
  };
  
  const now = Date.now();
  const maxTime = now + (24 * 60 * 60 * 1000); // 24 horas no futuro
  
  matches.forEach(match => {
    const commenceTime = new Date(match.commence_time).getTime();
    
    // 1. Filtrar jogos que começarão em no máximo 24 horas
    if (commenceTime > maxTime || commenceTime < now) return;
    
    // 2. Encontrar o bookmaker Betsson
    const betsson = match.bookmakers?.find(b => b.key === API_CONFIG.bookmakerKey);
    if (!betsson) return;
    
    // 3. Encontrar o mercado 'totals'
    const totalsMarket = betsson.markets?.find(m => m.key === API_CONFIG.marketKey);
    if (!totalsMarket) return;
    
    const matchInfo = {
      time: match.commence_time,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      league: match.sport_title, // Usando o título do esporte como nome da liga
      country: 'N/A' // A The Odds API não fornece o país diretamente no endpoint de odds
    };
    
    // 4. Processar cada outcome (Over/Under)
    totalsMarket.outcomes.forEach(outcome => {
      const point = outcome.point;
      const odd = outcome.price;
      
      if (outcome.name === 'Over') {
        // Over 0.5
        if (point === 0.5 && odd >= 1.10) {
          results.over05.push({
            ...matchInfo,
            odds: odd.toFixed(2),
            handicap: '0.5'
          });
        }
        
        // Over 1.5
        if (point === 1.5 && odd >= 1.50) {
          results.over15.push({
            ...matchInfo,
            odds: odd.toFixed(2),
            handicap: '1.5'
          });
        }
      }
    });
  });
  
  // 5. Ordenar por odds (maior para menor)
  results.over05.sort((a, b) => parseFloat(b.odds) - parseFloat(a.odds));
  results.over15.sort((a, b) => parseFloat(b.odds) - parseFloat(a.odds));
  
  return results;
}

// Rota de debug para ver dados brutos da API
app.get('/api/raw', async (req, res) => {
  try {
    const url = `${API_CONFIG.baseUrl}/${API_CONFIG.sportKey}/odds/?apiKey=${API_CONFIG.apiKey}&regions=${API_CONFIG.regions}&markets=${API_CONFIG.marketKey}&oddsFormat=${API_CONFIG.oddsFormat}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      url_api: url,
      data: data
    });
  } catch (error) {
    console.error('Erro no raw data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota principal da API
app.get('/api/scanner', async (req, res) => {
  try {
    console.log('Iniciando scan...');
    const matches = await fetchFixturesWithOdds();
    console.log(`Encontrados ${matches.length} jogos`);
    
    const results = processMatches(matches);
    console.log(`Over 0.5: ${results.over05.length}, Over 1.5: ${results.over15.length}`);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: results
    });
  } catch (error) {
    console.error('Erro no scanner:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
