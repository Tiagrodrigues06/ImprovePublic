// Application State
let rawData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 100;
let currentTab = 'tab-marcadores';
let activeCategoriaChips = [];

// DOM Elements
const elements = {
    nome: document.getElementById('nome'),
    categoriaChips: document.getElementById('categoria-chips'),
    divisao: document.getElementById('divisao'),
    equipa: document.getElementById('equipa'),
    posicao: document.getElementById('posicao'),
    idadeMin: document.getElementById('idade-min'),
    idadeMax: document.getElementById('idade-max'),
    idadeVal: document.getElementById('idade-val'),
    minJogos: document.getElementById('min-jogos'),
    jogosVal: document.getElementById('jogos-val'),
    resetBtn: document.getElementById('reset-filters'),
    
    tableHead: document.getElementById('table-head'),
    tableBody: document.getElementById('table-body'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    pageInfo: document.getElementById('page-info'),
    
    metricTotal: document.getElementById('metric-total'),
    metricMaxGols: document.getElementById('metric-max-gols'),
    metricAvgIdade: document.getElementById('metric-avg-idade'),
    metricTotalGols: document.getElementById('metric-total-gols'),
    
    tabs: document.querySelectorAll('.tab-btn')
};

// Categoria Mapping
const categoriasMap = {
    "Liga Nacional": ["CP_SerieA", "CP_SerieB", "CP_SerieC", "CP_SerieD", "Liga3_SerieA", "Liga3_SerieB"],
    "1ª Divisão Distrital": ["Braga", "Leiria", "Coimbra", "Vila_Real", "Algarve", "Aveiro", "Castelo_Branco", "Porto", "Lisboa", "Viseu", "Setubal", "Santarem", "Braganca", "Beja", "Evora", "Viana_Castelo", "Guarda", "Portalegre", "Madeira", "Acores"],
    "2ª Divisão Distrital": ["II_Lisboa_Serie1", "II_Lisboa_Serie2", "II_Porto_Serie1", "II_Porto_Serie2", "II_Porto_Serie3", "II_Algarve", "II_Aveiro", "II_Beja", "II_Braga_SerieA", "II_Braga_SerieB", "II_Braga_SerieC", "II_Coimbra", "II_Evora", "II_Guarda", "II_Leiria", "II_Santarem", "II_Setubal", "II_Viana_Castelo", "II_Viseu"],
    "Ligas Formação": ["Sub23-SerieNorte", "Sub23-SerieSul", "I_sub19_SerieNorte", "I_sub19_SerieSul", "II_sub19-SerieA", "II_sub19-SerieB", "II_sub19-SerieC", "II_sub19-SerieD"],
    "Estrangeiro": ["National_I", "Copinha"]
};

// Obter Categoria de uma Divisão
function getCategoria(divisao) {
    for (const [cat, divs] of Object.entries(categoriasMap)) {
        if (divs.includes(divisao)) return cat;
    }
    return "Outro";
}

// Inicialização
async function init() {
    try {
        const response = await fetch('scouting_data.json');
        if (!response.ok) throw new Error('Falha ao carregar ficheiro JSON.');
        rawData = await response.json();
        
        // Pre-processamento
        rawData.forEach(row => {
            row.Categoria = getCategoria(row.Divisao);
            row.GM = row.GM || 0;
            row.M = row.M || 0;
            row.J = row.J || 0;
            row.MG = row.GM > 0 ? (row.M / row.GM).toFixed(1) : 0;
        });
        
        // Remover duplicados (manter jogador com mais J e M)
        // Isso foi feito no backend (migrar_para_bd.py)? Não, migrar_para_bd.py não faz sort/drop_duplicates
        // Vamos fazer aqui para imitar Streamlit perfeitamente
        rawData.sort((a, b) => b.J - a.J || b.M - a.M);
        const uniquePlayers = new Map();
        rawData.forEach(row => {
            if (!uniquePlayers.has(row.Jogador)) {
                uniquePlayers.set(row.Jogador, row);
            }
        });
        rawData = Array.from(uniquePlayers.values());

        populateSelects();
        setupEventListeners();
        applyFilters();
    } catch (error) {
        elements.tableBody.innerHTML = `<tr><td colspan="100%" style="color: #ef4444; text-align: center;">Erro: ${error.message} <br> Certifique-se que executou o bot e exportou os dados localmente.</td></tr>`;
    }
}

function populateSelects() {
    const divisoes = [...new Set(rawData.map(r => r.Divisao).filter(Boolean))].sort();
    const equipas = [...new Set(rawData.map(r => r.Equipa).filter(Boolean))].sort();
    const posicoes = [...new Set(rawData.map(r => r.Posicao).filter(Boolean))].sort();
    
    elements.divisao.innerHTML = divisoes.map(d => `<option value="${d}">${d}</option>`).join('');
    elements.equipa.innerHTML = equipas.map(e => `<option value="${e}">${e}</option>`).join('');
    elements.posicao.innerHTML = posicoes.map(p => `<option value="${p}">${p}</option>`).join('');
    
    // Idade Slider min/max
    const idades = rawData.map(r => r.Idade).filter(i => i !== null && !isNaN(i));
    if(idades.length > 0) {
        const minId = Math.min(...idades);
        const maxId = Math.max(...idades);
        elements.idadeMin.min = minId; elements.idadeMin.max = maxId; elements.idadeMin.value = minId;
        elements.idadeMax.min = minId; elements.idadeMax.max = maxId; elements.idadeMax.value = maxId;
        updateIdadeLabel();
    }
}

function updateIdadeLabel() {
    const min = Math.min(elements.idadeMin.value, elements.idadeMax.value);
    const max = Math.max(elements.idadeMin.value, elements.idadeMax.value);
    elements.idadeVal.innerText = `${min} - ${max} anos`;
}

function setupEventListeners() {
    elements.nome.addEventListener('input', applyFilters);
    
    elements.categoriaChips.addEventListener('click', (e) => {
        if(e.target.classList.contains('chip')) {
            e.target.classList.toggle('active');
            const val = e.target.getAttribute('data-value');
            if(activeCategoriaChips.includes(val)) {
                activeCategoriaChips = activeCategoriaChips.filter(v => v !== val);
            } else {
                activeCategoriaChips.push(val);
            }
            applyFilters();
        }
    });
    
    elements.divisao.addEventListener('change', applyFilters);
    elements.equipa.addEventListener('change', applyFilters);
    elements.posicao.addEventListener('change', applyFilters);
    
    elements.idadeMin.addEventListener('input', () => { updateIdadeLabel(); applyFilters(); });
    elements.idadeMax.addEventListener('input', () => { updateIdadeLabel(); applyFilters(); });
    
    elements.minJogos.addEventListener('input', (e) => {
        elements.jogosVal.innerText = e.target.value;
        applyFilters();
    });
    
    elements.resetBtn.addEventListener('click', () => {
        elements.nome.value = '';
        activeCategoriaChips = [];
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        elements.divisao.selectedIndex = -1;
        elements.equipa.selectedIndex = -1;
        elements.posicao.selectedIndex = -1;
        elements.idadeMin.value = elements.idadeMin.min;
        elements.idadeMax.value = elements.idadeMax.max;
        updateIdadeLabel();
        elements.minJogos.value = 5;
        elements.jogosVal.innerText = 5;
        applyFilters();
    });
    
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.getAttribute('data-tab');
            currentPage = 1;
            renderView();
        });
    });
    
    elements.btnPrev.addEventListener('click', () => {
        if(currentPage > 1) { currentPage--; renderTable(); }
    });
    
    elements.btnNext.addEventListener('click', () => {
        const maxPage = Math.ceil(getTabData().length / rowsPerPage);
        if(currentPage < maxPage) { currentPage++; renderTable(); }
    });
}

function getSelectedOptions(selectElement) {
    return Array.from(selectElement.selectedOptions).map(opt => opt.value);
}

function applyFilters() {
    const nome = elements.nome.value.toLowerCase();
    const selDivisoes = getSelectedOptions(elements.divisao);
    const selEquipas = getSelectedOptions(elements.equipa);
    const selPosicoes = getSelectedOptions(elements.posicao);
    
    const minIdade = Math.min(elements.idadeMin.value, elements.idadeMax.value);
    const maxIdade = Math.max(elements.idadeMin.value, elements.idadeMax.value);
    const minJ = parseInt(elements.minJogos.value);
    
    filteredData = rawData.filter(row => {
        if (nome && !(row.Jogador && row.Jogador.toLowerCase().includes(nome))) return false;
        if (activeCategoriaChips.length > 0 && !activeCategoriaChips.includes(row.Categoria)) return false;
        if (selDivisoes.length > 0 && !selDivisoes.includes(row.Divisao)) return false;
        if (selEquipas.length > 0 && !selEquipas.includes(row.Equipa)) return false;
        if (selPosicoes.length > 0 && !selPosicoes.includes(row.Posicao)) return false;
        if (row.Idade !== null && !isNaN(row.Idade) && (row.Idade < minIdade || row.Idade > maxIdade)) return false;
        if (row.J < minJ) return false;
        return true;
    });
    
    currentPage = 1;
    updateMetrics();
    renderView();
}

function updateMetrics() {
    elements.metricTotal.innerText = filteredData.length;
    
    let maxGM = 0;
    let sumIdade = 0;
    let countIdade = 0;
    let totalGols = 0;
    
    filteredData.forEach(r => {
        if (r.GM > maxGM) maxGM = r.GM;
        if (r.Idade !== null && !isNaN(r.Idade)) {
            sumIdade += parseInt(r.Idade);
            countIdade++;
        }
        totalGols += r.GM;
    });
    
    elements.metricMaxGols.innerText = maxGM;
    elements.metricAvgIdade.innerText = countIdade > 0 ? (sumIdade / countIdade).toFixed(1) : "N/A";
    elements.metricTotalGols.innerText = totalGols;
}

function getTabData() {
    let data = [...filteredData];
    
    switch(currentTab) {
        case 'tab-marcadores':
            data.sort((a, b) => b.GM - a.GM);
            break;
        case 'tab-eficiencia':
            data = data.filter(d => d.GM >= 2);
            data.sort((a, b) => parseFloat(a.MG) - parseFloat(b.MG));
            break;
        case 'tab-plantel':
            // Sem sort específico
            break;
        case 'tab-u23-mins':
            data = data.filter(d => d.Idade !== null && d.Idade < 23);
            data.sort((a, b) => {
                if (a.Divisao < b.Divisao) return -1;
                if (a.Divisao > b.Divisao) return 1;
                return b.M - a.M;
            });
            // Top 3 por divisao
            data = topNPerGroup(data, 'Divisao', 3);
            break;
        case 'tab-u23-gols':
            data = data.filter(d => d.Idade !== null && d.Idade < 23);
            data.sort((a, b) => {
                if (a.Divisao < b.Divisao) return -1;
                if (a.Divisao > b.Divisao) return 1;
                return b.GM - a.GM;
            });
            // Top 3 por divisao
            data = topNPerGroup(data, 'Divisao', 3);
            break;
    }
    return data;
}

function topNPerGroup(data, groupKey, n) {
    const counts = {};
    return data.filter(row => {
        const val = row[groupKey];
        counts[val] = (counts[val] || 0) + 1;
        return counts[val] <= n;
    });
}

function renderView() {
    const data = getTabData();
    const columns = getColumnsForTab();
    
    // Headers
    elements.tableHead.innerHTML = columns.map(c => `<th>${c.label}</th>`).join('');
    
    renderTable();
}

function getColumnsForTab() {
    const base = [
        { key: 'Jogador', label: 'Jogador' },
        { key: 'Equipa', label: 'Equipa' },
        { key: 'Divisao', label: 'Divisão' },
        { key: 'Idade', label: 'Idade' },
        { key: 'Posicao', label: 'Posição' },
        { key: 'J', label: 'J' },
        { key: 'M', label: 'M' },
        { key: 'GM', label: 'Golos' },
        { key: 'ZeroZero', label: 'Perfil' }
    ];
    
    if (currentTab === 'tab-eficiencia') {
        base.splice(8, 0, { key: 'MG', label: 'Mins/Golo' });
    }
    return base;
}

function renderTable() {
    const data = getTabData();
    const columns = getColumnsForTab();
    
    const maxPage = Math.ceil(data.length / rowsPerPage) || 1;
    if (currentPage > maxPage) currentPage = maxPage;
    
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = data.slice(start, end);
    
    if (pageData.length === 0) {
        elements.tableBody.innerHTML = `<tr><td colspan="${columns.length}" style="text-align: center; padding: 40px;">Nenhum jogador encontrado com os filtros atuais.</td></tr>`;
    } else {
        elements.tableBody.innerHTML = pageData.map(row => {
            return `<tr>
                ${columns.map(c => {
                    if (c.key === 'ZeroZero') {
                        return `<td>${row.ZeroZero ? `<a href="${row.ZeroZero}" target="_blank">Ver Perfil</a>` : '-'}</td>`;
                    }
                    return `<td>${row[c.key] !== null && row[c.key] !== undefined ? row[c.key] : '-'}</td>`;
                }).join('')}
            </tr>`;
        }).join('');
    }
    
    // Paginação
    elements.pageInfo.innerText = `Página ${currentPage} de ${maxPage}`;
    elements.btnPrev.disabled = currentPage === 1;
    elements.btnNext.disabled = currentPage === maxPage;
}

// Iniciar aplicação
document.addEventListener('DOMContentLoaded', init);
