document.addEventListener('DOMContentLoaded', function() {
    const btnAtualizar = document.getElementById('btnAtualizar');
    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    const loading = document.getElementById('loading');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    // Carregar automaticamente
    setTimeout(carregarJogos, 500);
    
    // Event listeners
    btnAtualizar.addEventListener('click', carregarJogos);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Atualizar tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Função principal
    async function carregarJogos() {
        mostrarLoading(true);
        btnAtualizar.disabled = true;
        btnAtualizar.innerHTML = '🔍 Varrendo Betano...';
        ultimaAtualizacao.innerHTML = '🔄 Buscando TODOS os jogos (48h)...';
        ultimaAtualizacao.style.color = '#666';
        
        try {
            const inicio = Date.now();
            const response = await fetch('/api/jogos');
            const data = await response.json();
            
            const tempoTotal = Date.now() - inicio;
            
            if (data.erro) {
                // Modo fallback
                exibirJogos(data.over05, 'jogosOver05', '0.5', true);
                exibirJogos(data.over15, 'jogosOver15', '1.5', true);
                
                ultimaAtualizacao.innerHTML = `⚠️ ${data.mensagem} (${tempoTotal}ms)`;
                ultimaAtualizacao.style.color = '#ff9800';
                
                // Adicionar botão para forçar atualização
                adicionarBotaoDebug();
            } else {
                // Dados reais
                exibirJogos(data.over05, 'jogosOver05', '0.5', false);
                exibirJogos(data.over15, 'jogosOver15', '1.5', false);
                
                let mensagem = `✅ ${data.atualizacao} | ${tempoTotal}ms`;
                
                if (data.estatisticas) {
                    const stats = data.estatisticas;
                    mensagem += ` | 🎯 ${stats.over05} Over 0.5 | ${stats.over15} Over 1.5`;
                    mensagem += ` | 🔍 ${stats.comBetano} com Betano`;
                }
                
                ultimaAtualizacao.innerHTML = mensagem;
                ultimaAtualizacao.style.color = '#00a650';
            }
            
        } catch (error) {
            console.error('Erro:', error);
            ultimaAtualizacao.innerHTML = '❌ Erro de conexão com o servidor';
            ultimaAtualizacao.style.color = '#dc3545';
            
            exibirErro('jogosOver05', 'Erro de conexão com o servidor');
            exibirErro('jogosOver15', 'Tente novamente em alguns instantes');
        } finally {
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.innerHTML = '🔄 Atualizar Scanner';
        }
    }
    
    function exibirJogos(jogos, containerId, tipoOver, ehFallback = false) {
        const container = document.getElementById(containerId);
        const oddsMinimas = tipoOver === '0.5' ? '1.10' : '1.50';
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 3rem; margin-bottom: 15px;">😕</div>
                    <p style="font-weight: bold; margin-bottom: 10px;">Nenhum jogo encontrado</p>
                    <p style="margin-bottom: 5px;">Critérios:</p>
                    <ul style="text-align: left; display: inline-block; margin: 0 auto;">
                        <li>Over ${tipoOver} gols</li>
                        <li>Odds ≥ ${oddsMinimas}</li>
                        <li>Apenas Betano</li>
                        <li>Próximas 48 horas</li>
                    </ul>
                    ${ehFallback ? 
                        '<p style="margin-top: 20px; padding: 10px; background: #fff3cd; border-radius: 5px; color: #856404;">⚠️ Modo demonstração - API offline</p>' : 
                        '<p style="margin-top: 20px; color: #666;">Verifique se há jogos no site da Betano</p>'
                    }
                </div>`;
            return;
        }
        
        container.innerHTML = jogos.map((jogo, index) => `
            <div class="jogo-card" style="animation-delay: ${index * 0.1}s;">
                ${ehFallback ? 
                    '<div class="badge-fallback">MODO DEMONSTRAÇÃO</div>' : 
                    `<div class="badge-real">
                        <span class="odds-badge">${parseFloat(jogo['oddsOver' + tipoOver.replace('.', '')]).toFixed(2)}</span>
                    </div>`
                }
                <div class="jogo-header">
                    <span class="jogo-horario">🕒 ${jogo.horario}</span>
                    <span class="jogo-info-badge">
                        ${tipoOver === '0.5' ? '⚽' : '⚽⚽'} Over ${tipoOver}
                    </span>
                </div>
                <div class="jogo-times">${jogo.times}</div>
                <div class="jogo-campeonato">🏆 ${jogo.campeonato}</div>
                <div class="jogo-detalhes">
                    <div class="odds-display">
                        <span class="odds-value">${parseFloat(jogo['oddsOver' + tipoOver.replace('.', '')]).toFixed(2)}</span>
                        <span class="odds-label">ODDS</span>
                    </div>
                    <div class="casa-info">
                        <span class="casa-badge">Betano</span>
                        <span class="tempo-badge">48h</span>
                    </div>
                </div>
                ${index === 0 && jogos.length > 1 ? 
                    '<div class="melhor-aposta">🎯 MELHOR ODDS</div>' : ''
                }
            </div>
        `).join('');
    }
    
    function exibirErro(containerId, mensagem) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="vazio">
                <div style="color: #dc3545; font-size: 3rem; margin-bottom: 15px;">⚠️</div>
                <p style="color: #dc3545; font-weight: bold;">${mensagem}</p>
                <p style="margin-top: 15px; color: #666;">
                    Verifique sua conexão e tente novamente
                </p>
            </div>`;
    }
    
    function adicionarBotaoDebug() {
        if (!document.getElementById('btnDebug')) {
            const btn = document.createElement('button');
            btn.id = 'btnDebug';
            btn.innerHTML = '🛠️ Testar Conexão API';
            btn.style.cssText = `
                background: #6c757d;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 5px;
                margin-top: 15px;
                cursor: pointer;
                font-size: 0.9rem;
            `;
            btn.onclick = testarAPI;
            
            const controls = document.querySelector('.controls');
            if (controls) {
                controls.appendChild(btn);
            }
        }
    }
    
    async function testarAPI() {
        try {
            const response = await fetch('/api/jogos');
            const data = await response.json();
            alert(`Status API: ${data.sucesso ? 'OK' : 'ERRO'}\nMensagem: ${data.mensagem}`);
        } catch (error) {
            alert('Falha ao testar API: ' + error.message);
        }
    }
    
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
});