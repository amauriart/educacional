document.addEventListener('DOMContentLoaded', function() {
    const btnAtualizar = document.getElementById('btnAtualizar');
    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    const loading = document.getElementById('loading');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Event listeners
    btnAtualizar.addEventListener('click', carregarJogos);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Atualizar botões
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Atualizar conteúdo
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Função para carregar jogos
    async function carregarJogos() {
        mostrarLoading(true);
        btnAtualizar.disabled = true;
        btnAtualizar.innerHTML = '⏳ Buscando...';
        ultimaAtualizacao.innerHTML = '🔗 Conectando à API The Odds...';
        ultimaAtualizacao.style.color = '#666';
        
        try {
            const response = await fetch('/api/jogos');
            const data = await response.json();
            
            console.log('📊 Dados recebidos:', data);
            
            if (data.erro) {
                throw new Error(data.mensagem);
            }
            
            exibirJogos(data.over05, 'jogosOver05', '0.5');
            exibirJogos(data.over15, 'jogosOver15', '1.5');
            
            // Atualizar última atualização
            let mensagem = `🔄 Última atualização: ${data.atualizacao}`;
            
            if (data.totalJogos !== undefined) {
                mensagem += ` | 📊 ${data.totalJogos} jogos na API`;
            }
            
            if (data.jogosComBetano !== undefined) {
                mensagem += ` | 🎯 ${data.jogosComBetano} com Betano`;
            }
            
            if (data.mensagem) {
                mensagem += ` | ${data.mensagem}`;
            }
            
            ultimaAtualizacao.innerHTML = mensagem;
            ultimaAtualizacao.style.color = '#00a650';
            ultimaAtualizacao.style.fontWeight = 'bold';
            
        } catch (error) {
            console.error('❌ Erro ao carregar jogos:', error);
            ultimaAtualizacao.innerHTML = '❌ Erro: ' + error.message;
            ultimaAtualizacao.style.color = '#dc3545';
            
            // Limpar jogos anteriores
            document.getElementById('jogosOver05').innerHTML = 
                '<div class="vazio">❌ Erro ao buscar dados. Tente novamente.</div>';
            document.getElementById('jogosOver15').innerHTML = 
                '<div class="vazio">❌ Erro ao buscar dados. Tente novamente.</div>';
        } finally {
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.innerHTML = '🔄 Atualizar Scanner';
        }
    }
    
    // Função para exibir jogos
    function exibirJogos(jogos, containerId, tipoOver) {
        const container = document.getElementById(containerId);
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 2rem; margin-bottom: 10px;">😕</div>
                    <div>Nenhum jogo encontrado para Over ${tipoOver} gols</div>
                    <div style="font-size: 0.9rem; margin-top: 10px; color: #888;">
                        Critérios: Betano • Próximas 24h • Odds ≥ ${tipoOver === '0.5' ? '1.10' : '1.50'}
                    </div>
                </div>`;
            return;
        }
        
        container.innerHTML = jogos.map(jogo => `
            <div class="jogo-card" data-odds="${jogo['oddsOver' + tipoOver.replace('.', '')]}">
                <div class="jogo-header">
                    <span class="jogo-horario">🕒 ${jogo.horario}</span>
                    <span class="jogo-odds">📈 Over ${tipoOver}: <strong>${jogo['oddsOver' + tipoOver.replace('.', '')].toFixed(2)}</strong></span>
                </div>
                <div class="jogo-times">⚽ ${jogo.times}</div>
                <div class="jogo-campeonato">🏆 ${jogo.campeonato}</div>
                <div class="jogo-info">
                    <span style="color: #00a650;">✓ Betano</span> • 
                    <span>⏰ Próximas 24h</span>
                </div>
            </div>
        `).join('');
    }
    
    // Função para mostrar/ocultar loading
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
    
    // Carregar jogos automaticamente ao abrir a página
    setTimeout(() => {
        carregarJogos();
    }, 1000);
});