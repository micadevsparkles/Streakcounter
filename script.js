// CONFIGURAÇÃO
// 🔴 IMPORTANTE: COLE SUA URL DO APPS SCRIPT ABAIXO
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAQzHTs407RAlO3cUnuWbgnTSBiDz2cRbW9cNF64JNGEW9-2SzmOBVe9BaTzPXud-lDw/exec'; 

// Frases motivacionais
const quotes = [
    "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
    "Não pare quando estiver cansado. Pare quando tiver terminado.",
    "A disciplina te leva a lugares que a motivação não consegue.",
    "Se fosse fácil, todo mundo faria.",
    "Foco é dizer não.",
    "Seu único limite é a sua mente."
];

// Estado Global
let currentUser = null;
let userStreaks = [];
let timerInterval = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('quote-text').innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
    
    // Define data mínima no input date para hoje
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('start-time').value = now.toISOString().slice(0,16);
});

// Navegação
function showSection(sectionId) {
    document.querySelectorAll('section').forEach(sec => {
        sec.classList.remove('active-section');
        sec.classList.add('hidden-section');
    });
    document.getElementById(sectionId).classList.remove('hidden-section');
    document.getElementById(sectionId).classList.add('active-section');
}

function explainType() {
    const type = document.getElementById('streak-type').value;
    const txt = document.getElementById('type-explanation');
    if (type === "1") {
        txt.innerText = "Tipo 1: Contador automático contínuo. Reinicia ao clicar em 'Falhei'.";
    } else {
        txt.innerText = "Tipo 2: Marque 'Concluído' todo dia (00h-23h59). Se pular um dia, o contador zera.";
    }
}

// Loader
function toggleLoader(show) {
    const loader = document.getElementById('loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

// API Helper
async function callApi(data) {
    toggleLoader(true);
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            mode: "no-cors" // Google Apps Script requer isso ou redirect handling, mas para GET/POST simples text/plain resolve
            // Nota: com 'no-cors' não lemos a resposta diretamente facilmente em alguns browsers sem configs extras.
            // WORKAROUND: Usamos a URL como endpoint GET/POST padrão.
            // Para simplificar e garantir funcionamento no GitHub Pages, usaremos a técnica de enviar dados via POST 
            // mas esperando a resposta JSON. O Apps Script precisa retornar os headers CORS corretos?
            // O Apps Script já lida com redirects. Vamos usar o fetch padrão, 
            // mas o Apps Script deve estar como "Anyone".
        });
        
        // CORREÇÃO PARA FETCH NO APPS SCRIPT:
        // O fetch direto pode dar erro de CORS opaco. O método mais seguro é usar navigator.sendBeacon ou 
        // aceitar que ler a resposta pode ser complexo. 
        // MAS, vamos tentar o método padrão que funciona na maioria dos setups modernos de Apps Script Web App.
        
        // REFAZENDO A CHAMADA para garantir leitura do JSON (usando x-www-form-urlencoded se precisar, mas JSON costuma ir bem).
    } catch (error) {
        console.error(error);
        alert("Erro de conexão. Tente novamente.");
    }
    toggleLoader(false);
}

// Melhorada função de fetch para garantir leitura de resposta (workaround CORS)
// Como o Apps Script retorna JSON, precisamos de um truque ou confiar no redirect.
async function apiRequest(data) {
    toggleLoader(true);
    // Usamos URL params para GET se for leitura, mas POST é mais seguro para dados.
    // O Apps Script Web App suporta POST.
    
    const options = {
        method: 'POST',
        body: JSON.stringify(data)
    };

    try {
        const req = await fetch(APPS_SCRIPT_URL, options);
        const json = await req.json();
        toggleLoader(false);
        return json;
    } catch (e) {
        toggleLoader(false);
        console.log(e);
        // Em caso de erro de CORS (comum no Apps Script + Fetch), o dado pode ter sido salvo
        // mas não conseguimos ler a resposta. Porém, "Anyone" usually permite leitura.
        alert("Houve uma comunicação com o servidor. Se os dados não atualizarem, recarregue.");
        return null;
    }
}

// --- AÇÕES DO USUÁRIO ---

// Criar Ofensiva
document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = document.getElementById('new-username').value.trim();
    const tel = document.getElementById('new-tel').value;
    const title = document.getElementById('streak-title').value;
    const emoji = document.getElementById('streak-emoji').value;
    const start = document.getElementById('start-time').value;
    const type = document.getElementById('streak-type').value;

    // Verificar se user existe (se for a primeira vez criando)
    // Para simplificar, vamos tentar criar. Se o script achar user duplicado com info diferente, tratamos lá?
    // O requisito diz: "não pode salvar se já houver outro usuario".
    
    const check = await apiRequest({ action: "checkUser", usuario: user });
    
    // Se o usuário já existe, precisamos validar se é ELE MESMO (pelo telefone? O prompt não especifica login na criação)
    // Assumiremos: Se o user existe, vamos avisar "Usuário existe. Use outro ou faça login."
    // Mas o user pode estar criando a SEGUNDA ofensiva dele. Então precisamos ver se ele está logado.
    
    if (check.exists && currentUser !== user) {
        alert("Este nome de usuário já existe. Faça login em 'Minhas Ofensivas' para adicionar mais itens a sua conta, ou escolha outro nome.");
        return;
    }

    const payload = {
        action: "createUser",
        usuario: user,
        tel: tel,
        titulo: title,
        emoji: emoji,
        tempoInicio: new Date(start).toISOString(),
        tempoAtual: 0,
        tipo: type
    };

    const res = await apiRequest(payload);
    if (res && res.status === "success") {
        alert("Ofensiva criada com sucesso!");
        currentUser = user; // Auto-login
        showSection('my-streaks');
        document.getElementById('login-username').value = user;
        loadStreaks(); // Carregar dashboard
    }
});

// Login e Listar
async function loadStreaks() {
    const userInput = document.getElementById('login-username').value.trim();
    if (!userInput) return alert("Digite seu usuário.");

    currentUser = userInput;
    
    const res = await apiRequest({ action: "getStreaks", usuario: currentUser });
    
    if (res && res.data) {
        userStreaks = res.data;
        renderStreaks();
        
        document.getElementById('login-area').classList.add('hidden');
        document.getElementById('dashboard-area').classList.remove('hidden');
        document.getElementById('user-welcome').innerText = `Ofensivas de ${currentUser}`;
    } else {
        alert("Nenhuma ofensiva encontrada ou erro ao buscar.");
    }
}

function logout() {
    currentUser = null;
    userStreaks = [];
    clearInterval(timerInterval);
    document.getElementById('login-area').classList.remove('hidden');
    document.getElementById('dashboard-area').classList.add('hidden');
    document.getElementById('login-username').value = "";
}

// Recuperar Usuário
async function recoverUser() {
    const tel = document.getElementById('recover-tel').value;
    const res = await apiRequest({ action: "recoverUser", tel: tel });
    
    const resultDisplay = document.getElementById('recover-result');
    if (res && res.found) {
        resultDisplay.innerText = `Seu usuário é: ${res.usuario}`;
        resultDisplay.style.color = "#04d361";
    } else {
        resultDisplay.innerText = "Telefone não encontrado.";
        resultDisplay.style.color = "#e65757";
    }
}

// --- LÓGICA DE RENDERIZAÇÃO E TEMPO ---

function renderStreaks() {
    const container = document.getElementById('streaks-list');
    container.innerHTML = "";
    
    if (userStreaks.length === 0) {
        container.innerHTML = "<p>Você ainda não tem ofensivas.</p>";
        return;
    }

    userStreaks.forEach((streak, index) => {
        const card = document.createElement('div');
        card.className = 'streak-card';
        
        let controlButtons = "";
        let timeDisplayId = `timer-${index}`;
        
        // Configuração Tipo 1
        if (streak.tipo == "1") {
            controlButtons = `<button class="btn-danger" onclick="updateStreak(${index}, 'fail')">Eu falhei (Reiniciar)</button>`;
        } 
        // Configuração Tipo 2
        else {
            // Verifica se já fez hoje
            const lastCheckin = new Date(streak.tempoInicio); // No tipo 2, tempoInicio guarda ultimo checkin (ver lógica AppScript)
            const today = new Date();
            const isToday = lastCheckin.toDateString() === today.toDateString();
            
            if (isToday) {
                controlButtons = `<button class="btn-secondary" disabled>Tarefa Concluída Hoje ✅</button>`;
            } else {
                controlButtons = `<button class="btn-success" onclick="updateStreak(${index}, 'done')">Tarefa Concluída</button>`;
            }
        }

        card.innerHTML = `
            <div class="streak-header">
                <span class="streak-emoji">${streak.emoji || '🔥'}</span>
                <span class="streak-type-badge">Tipo ${streak.tipo}</span>
            </div>
            <div class="streak-info">
                <h3>${streak.titulo}</h3>
                <div id="${timeDisplayId}" class="streak-timer">Calculando...</div>
                ${controlButtons}
            </div>
        `;
        container.appendChild(card);
    });

    // Iniciar atualização visual dos relógios
    startTimers();
}

function startTimers() {
    if (timerInterval) clearInterval(timerInterval);
    
    // Atualiza a cada segundo apenas para visualização
    timerInterval = setInterval(() => {
        userStreaks.forEach((streak, index) => {
            const el = document.getElementById(`timer-${index}`);
            if (!el) return;

            if (streak.tipo == "1") {
                // Tipo 1: Diferença entre AGORA e INICIO
                const start = new Date(streak.tempoInicio);
                const now = new Date();
                const diff = now - start;
                
                // Formatação Dias, Horas, Min, Seg
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                el.innerText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            } else {
                // Tipo 2: Mostra o contador de dias (vem do DB)
                // O valor vem na coluna TEMPOATUAL (usado como contador)
                const days = streak.tempoAtual || 0;
                el.innerText = `${days} Dias Concluídos`;
            }
        });
    }, 1000);
}

async function updateStreak(index, actionType) {
    const streak = userStreaks[index];
    
    if (streak.tipo == "2" && actionType == "done") {
        // Validação Front-end simples de horário (00:00 - 23:59 é sempre true para Date local, mas ok)
        // Apenas envia
    }

    if (!confirm(actionType === 'fail' ? "Tem certeza que falhou? O contador será zerado." : "Confirmar conclusão da tarefa hoje?")) {
        return;
    }

    const payload = {
        action: "updateStreak",
        rowIndex: streak.rowIndex,
        tipo: streak.tipo
    };

    const res = await apiRequest(payload);
    if (res && res.status === "success") {
        // Recarregar lista para pegar dados atualizados do servidor
        loadStreaks(); 
    }
}
