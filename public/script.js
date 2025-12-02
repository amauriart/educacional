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
        btnAtualizar.textContent = 'Buscando...';
        
        try {
            const response = await fetch('/api/jogos');
            const data = await response.json();
            
            exibirJogos(data.over05, 'jogosOver05', '0.5');
            exibirJogos(data.over15, 'jogosOver15', '1.5');
            
            // Atualizar última atualização
            ultimaAtualizacao.textContent = `Última atualização: ${data.atualizacao || new Date().toLocaleTimeString('pt-BR')}`;
            ultimaAtualizacao.style.color = '#00a650';
            ultimaAtualizacao.style.fontWeight = 'bold';
            
        } catch (error) {
            console.error('Erro ao carregar jogos:', error);
            ultimaAtualizacao.textContent = '❌ Erro ao buscar jogos. Tente novamente.';
            ultimaAtualizacao.style.color = '#dc3545';
        } finally {
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.textContent = '🔄 Atualizar Scanner';
        }
    }
    
    // Função para exibir jogos
    function exibirJogos(jogos, containerId, tipoOver) {
        const container = document.getElementById(containerId);
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = '<div class="vazio">Nenhum jogo encontrado com os critérios para Over ' + tipoOver + ' gols.</div>';
            return;
        }
        
        container.innerHTML = jogos.map(jogo => `
            <div class="jogo-card">
                <div class="jogo-header">
                    <span class="jogo-horario">${jogo.horario}</span>
                    <span class="jogo-odds">Over ${tipoOver}: ${jogo['oddsOver' + tipoOver.replace('.', '')]}</span>
                </div>
                <div class="jogo-times">${jogo.times}</div>
                <div class="jogo-campeonato">${jogo.campeonato}</div>
            </div>
        `).join('');
    }
    
    // Função para mostrar/ocultar loading
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
});