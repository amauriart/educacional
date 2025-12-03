// Elementos DOM
const scanBtn = document.getElementById('scanBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const lastUpdate = document.getElementById('lastUpdate');
const errorMsg = document.getElementById('errorMsg');
const over05Count = document.getElementById('over05Count');
const over15Count = document.getElementById('over15Count');
const tbody05 = document.getElementById('tbody05');
const tbody15 = document.getElementById('tbody15');

// Função para formatar data/hora
function formatDateTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
}

// Função para criar linha da tabela
function createTableRow(match) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td class="time-cell">${formatDateTime(match.time)}</td>
        <td class="teams-cell">${match.homeTeam} vs ${match.awayTeam}</td>
        <td class="league-cell">${match.league} (${match.country})</td>
        <td class="odds-cell">${match.odds}</td>
    `;
    
    return row;
}

// Função para popular tabela
function populateTable(tbody, matches) {
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">Nenhum jogo encontrado com os critérios especificados</td></tr>';
        return;
    }
    
    matches.forEach(match => {
        tbody.appendChild(createTableRow(match));
    });
}

// Função para mostrar erro
function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    setTimeout(() => {
        errorMsg.style.display = 'none';
    }, 5000);
}

// Função para atualizar UI de loading
function setLoading(isLoading) {
    scanBtn.disabled = isLoading;
    
    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'block';
    } else {
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
}

// Função principal de scan
async function performScan() {
    setLoading(true);
    errorMsg.style.display = 'none';
    
    try {
        const response = await fetch('/api/scanner');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Erro desconhecido');
        }
        
        // Atualizar contadores
        over05Count.textContent = `${result.data.over05.length} jogos encontrados`;
        over15Count.textContent = `${result.data.over15.length} jogos encontrados`;
        
        // Popular tabelas
        populateTable(tbody05, result.data.over05);
        populateTable(tbody15, result.data.over15);
        
        // Atualizar timestamp
        const updateTime = new Date(result.timestamp);
        lastUpdate.textContent = `Última atualização: ${formatDateTime(result.timestamp)}`;
        
    } catch (error) {
        console.error('Erro ao realizar scan:', error);
        showError(`Erro ao buscar dados: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// Event listener
scanBtn.addEventListener('click', performScan);

// Auto-scan ao carregar a página
window.addEventListener('load', () => {
    setTimeout(performScan, 500);
});
