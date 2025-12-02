document.addEventListener('DOMContentLoaded', function() {
    const btnAtualizar = document.getElementById('btnAtualizar');
    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    const loading = document.getElementById('loading');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    // Carregar ao iniciar
    setTimeout(carregarDados, 500);
    
    // Eventos
    btnAtualizar.addEventListener('click', carregarDados);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    async function carregarDados() {
        mostrarLoading(true);
        btnAtualizar.disabled = true;
        btnAtualizar.textContent = '🔍 Buscando dados REAIS...';
        ultimaAtualizacao.textContent = 'Conectando à SoccerAPI...';
        ultimaAtualizacao.style.color = '#666';
        
        try {
            const inicio = Date.now();
            const resposta = await fetch('/api/jogos');
            const dados = await resposta.json();
            const tempo = Date.now() - inicio;
            
            atualizarInterface(dados, tempo);
            
        } catch (erro) {
            console.error('Erro:', erro);
            ultimaAtualizacao.textContent = '❌ Erro de conexão';
            ultimaAtualizacao.style.color = '#dc3545';
            
            document.getElementById('jogosOver05').innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro de conexão</p>
                    <p>Verifique sua internet</p>
                </div>`;
                
            document.getElementById('jogosOver15').innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro de conexão</p>
                </div>`;
        } finally {
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.textContent = '🔄 Atualizar Scanner';
        }
    }
    
    function atualizarInterface(dados, tempo) {
        // Exibir jogos
        exibirJogos(dados.over05 || [], 'jogosOver05', '0.5', dados.erro, dados.estatisticas?.fonte);
        exibirJogos(dados.over15 || [], 'jogosOver15', '1.5', dados.erro, dados.estatisticas?.fonte);
        
        // Atualizar status
        let status = `${dados.erro ? '⚠️' : '✅'} ${dados.atualizacao || new Date().toLocaleTimeString('pt-BR')}`;
        status += ` | ${tempo}ms`;
        
        if (dados.estatisticas) {
            status += ` | ${dados.estatisticas.over05 || 0} Over 0.5`;
            status += ` | ${dados.estatisticas.over15 || 0} Over 1.5`;
            
            // Mostrar fonte dos dados
            if (dados.estatisticas.fonte) {
                const fonte = dados.estatisticas.fonte.includes('real') ? 'REAIS' : 'EXEMPLO';
                status += ` | 📡 ${fonte}`;
            }
        }
        
        if (dados.mensagem) {
            status += ` | ${dados.mensagem.substring(0, 30)}...`;
        }
        
        ultimaAtualizacao.textContent = status;
        ultimaAtualizacao.style.color = dados.erro ? '#ff9800' : '#00a650';
    }
    
    function exibirJogos(jogos, containerId, tipo, erro, fonte) {
        const container = document.getElementById(containerId);
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 3rem; margin-bottom: 15px;">
                        ${erro ? '⚠️' : '😕'}
                    </div>
                    <p style="font-weight: bold; margin-bottom: 10px;">
                        ${erro ? 'API retornou sem dados' : 'Nenhum jogo encontrado'}
                    </p>
                    <p style="color: #666; margin-bottom: 15px;">
                        Over ${tipo} | Odds ≥ ${tipo === '0.5' ? '1.10' : '1.50'} | Betano
                    </p>
                    ${fonte && fonte.includes('example') ? 
                        '<p style="padding: 10px; background: #fff3cd; border-radius: 5px;">⚠️ Dados de exemplo - API não retornou odds</p>' : 
                        ''
                    }
                </div>`;
            return;
        }
        
        const dadosReais = fonte && fonte.includes('real');
        
        container.innerHTML = jogos.map((jogo, i) => `
            <div class="jogo-card">
                ${dadosReais ? 
                    '<div style="position: absolute; top: 10px; right: 10px; background: #00a650; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold;">REAL</div>' : 
                    '<div style="position: absolute; top: 10px; right: 10px; background: #ff9800; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold;">EXEMPLO</div>'
                }
                <div class="jogo-header">
                    <span class="jogo-horario">${jogo.horario}</span>
                    <span class="jogo-odds">
                        Over ${tipo}: <strong>${jogo['oddsOver' + tipo.replace('.', '')].toFixed(2)}</strong>
                    </span>
                </div>
                <div class="jogo-times">${jogo.times}</div>
                <div class="jogo-campeonato">${jogo.campeonato}</div>
                <div class="jogo-info">
                    <span style="color: #00a650;">${dadosReais ? '✓' : '⚡'} Betano</span>
                    <span>• Próximas 48h</span>
                </div>
            </div>
        `).join('');
    }
    
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
});