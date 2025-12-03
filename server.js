const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações da API
const API_CONFIG = {
  baseUrl: 'https://api.soccersapi.com/v2.2',
  user: '0x3YU',
  token: 'UVZnFqmGWH',
  bet365Id: 2,
  marketOverUnder: 2
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Função para buscar fixtures com odds
async function fetchFixturesWithOdds() {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = tomorrow.toISOString().split('T')[0];
    
    const url = `${API_CONFIG.baseUrl}/fixtures/?user=${API_CONFIG.user}&token=${API_CONFIG.token}&t=schedule&date_from=${dateFrom}&date_to=${dateTo}&include=odds_prematch`;
    
    console.log('Fetching from:', url);
    const response = await fetch(url);
    const data = await response.json();
    
    return data.data || [];
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
  
  matches.forEach(match => {
    // Verificar se é futebol (soccer)
    if (!match.league || !match.teams) return;
    
    const matchInfo = {
      time: match.time.datetime,
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      league: match.league.name,
      country: match.league.country_name
    };
    
    // Procurar mercado Over/Under
    const overUnderMarket = match.odds_prematch?.find(m => m.id == API_CONFIG.marketOverUnder);
    if (!overUnderMarket) return;
    
    // Procurar Bet365
    const bet365 = overUnderMarket.bookmakers?.find(b => b.id == API_CONFIG.bet365Id);
    if (!bet365 || !bet365.odds?.data) return;
    
    const oddsData = Array.isArray(bet365.odds.data) ? bet365.odds.data : [bet365.odds.data];
    
    // Processar cada handicap
    oddsData.forEach(odd => {
      const handicap = odd.handicap;
      const overOdd = parseFloat(odd.over);
      
      if (!handicap || !overOdd) return;
      
      // Verificar Over 0.5
      if (handicap.includes('0.5') && overOdd >= 1.10) {
        results.over05.push({
          ...matchInfo,
          odds: overOdd.toFixed(2),
          handicap: '0.5'
        });
      }
      
      // Verificar Over 1.5
      if (handicap.includes('1.5') && overOdd >= 1.50) {
        results.over15.push({
          ...matchInfo,
          odds: overOdd.toFixed(2),
          handicap: '1.5'
        });
      }
    });
  });
  
  // Ordenar por odds (maior para menor)
  results.over05.sort((a, b) => parseFloat(b.odds) - parseFloat(a.odds));
  results.over15.sort((a, b) => parseFloat(b.odds) - parseFloat(a.odds));
  
  return results;
}

// Rota de debug para ver dados brutos da API
app.get('/api/raw', async (req, res) => {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = tomorrow.toISOString().split('T')[0];
    
    const url = `${API_CONFIG.baseUrl}/fixtures/?user=${API_CONFIG.user}&token=${API_CONFIG.token}&t=schedule&date_from=${dateFrom}&date_to=${dateTo}&include=odds_prematch`;
    
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
