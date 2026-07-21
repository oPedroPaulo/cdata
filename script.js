import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração do Firebase Cloud Firestore
const firebaseConfig = {
  apiKey: "AIzaSyBXRq50gBs-4FTggwoF-CDBS2C-IQ77i2Y",
  authDomain: "controldatafinanceiro.firebaseapp.com",
  projectId: "controldatafinanceiro",
  storageBucket: "controldatafinanceiro.firebasestorage.app",
  messagingSenderId: "67822038351",
  appId: "1:67822038351:web:3a52f86ed0e1d82dd0a93a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let bancos = [];
let compras = [];
let faturasInfo = {};
let tags = [];

// Instância do Gráfico Chart.js
let tagsChartInstance = null;

// --- ELEMENTOS DO DOM ---
const formBanco = document.getElementById('form-banco');
const formCompra = document.getElementById('form-compra');
const selectBanco = document.getElementById('select-banco');
const tipoPagamento = document.getElementById('tipo-pagamento');
const parcelasCompra = document.getElementById('parcelas-compra');
const selectTag = document.getElementById('select-tag');
const editSelectTag = document.getElementById('edit-select-tag');

const listaBancosFaturas = document.getElementById('lista-bancos-faturas');
const bancosCarrosselContainer = document.getElementById('bancos-carrossel-container');

const valorDividaTotal = document.getElementById('valor-divida-total');
const valorProximoMes = document.getElementById('valor-proximo-mes');
const labelProximoMes = document.getElementById('label-proximo-mes');

const btnExportar = document.getElementById('btn-exportar');
const btnImportar = document.getElementById('btn-importar');
const inputImportar = document.getElementById('input-importar');

const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// --- FUNÇÕES UTILITÁRIAS ---
const configurarTipoPagamento = (selectElem, parcelasElem) => {
    if (!selectElem || !parcelasElem) return; 
    selectElem.addEventListener('change', (e) => {
        if (e.target.value === 'parcelado') {
            parcelasElem.classList.remove('hidden');
            parcelasElem.setAttribute('required', 'true');
        } else {
            parcelasElem.classList.add('hidden');
            parcelasElem.removeAttribute('required');
            parcelasElem.value = '';
        }
    });
};

configurarTipoPagamento(tipoPagamento, parcelasCompra);
configurarTipoPagamento(document.getElementById('edit-tipo-pagamento'), document.getElementById('edit-parcelas-compra'));

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const formatarMesAno = (key) => {
    const [ano, mes] = key.split('-');
    return `${nomeMeses[parseInt(mes) - 1]} de ${ano}`;
};

// --- ATUALIZAR SELECT DE BANCOS E TAGS ---
const atualizarSelects = () => {
    if (selectBanco) selectBanco.innerHTML = '<option value="">Selecione o Cartão</option>';
    const editSelect = document.getElementById('edit-select-banco');
    if (editSelect) editSelect.innerHTML = '<option value="">Selecione o Banco</option>';
    
    bancos.forEach(banco => {
        if (selectBanco) {
            let opt1 = document.createElement('option');
            opt1.value = banco.id; opt1.textContent = banco.nome;
            selectBanco.appendChild(opt1);
        }
        if (editSelect) {
            let opt2 = document.createElement('option');
            opt2.value = banco.id; opt2.textContent = banco.nome;
            editSelect.appendChild(opt2);
        }
    });

    if (selectTag) selectTag.innerHTML = '<option value="">Sem Tag</option>';
    if (editSelectTag) editSelectTag.innerHTML = '<option value="">Sem Tag</option>';

    tags.forEach(tag => {
        if (selectTag) {
            let opt1 = document.createElement('option');
            opt1.value = tag.id; opt1.textContent = tag.nome;
            selectTag.appendChild(opt1);
        }
        if (editSelectTag) {
            let opt2 = document.createElement('option');
            opt2.value = tag.id; opt2.textContent = tag.nome;
            editSelectTag.appendChild(opt2);
        }
    });
};

const processarFaturas = () => {
    const faturasPorBanco = {}; 
    bancos.forEach(b => faturasPorBanco[b.id] = {});

    compras.forEach(compra => {
        if (!compra || !compra.bancoId) return;
        const banco = bancos.find(b => b.id === compra.bancoId);
        if (!banco) return;

        let dataCompra;
        let timestampCompra = 0;
        try {
            dataCompra = new Date(compra.data + 'T12:00:00'); 
            if (isNaN(dataCompra.getTime())) throw new Error();
            timestampCompra = dataCompra.getTime();
        } catch(e) {
            dataCompra = new Date(); 
            timestampCompra = dataCompra.getTime();
        }

        const diaCompra = dataCompra.getDate();
        let mesBase = dataCompra.getMonth();
        let anoBase = dataCompra.getFullYear();
        
        const fechamento = parseInt(banco.fechamento) || parseInt(banco.vencimento);
        const vencimento = parseInt(banco.vencimento);

        if (diaCompra > fechamento) mesBase++;
        if (vencimento < fechamento) mesBase++;

        while (mesBase > 11) {
            mesBase -= 12;
            anoBase++;
        }

        const qtdParcelas = compra.tipo === 'parcelado' ? (parseInt(compra.parcelas) || 1) : 1;
        const valorParcela = parseFloat(compra.valor) / qtdParcelas;

        let htmlTag = '';
        if (compra.tagId) {
            const tagEncontrada = tags.find(t => t.id === compra.tagId);
            if (tagEncontrada) {
                htmlTag = `<span class="tag-badge" style="background-color: ${tagEncontrada.cor}">${tagEncontrada.nome}</span>`;
            }
        }

        for (let i = 0; i < qtdParcelas; i++) {
            let mesAtual = mesBase + i;
            let anoAtual = anoBase + Math.floor(mesAtual / 12);
            mesAtual = mesAtual % 12;

            const keyMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;

            if (!faturasPorBanco[banco.id][keyMes]) {
                faturasPorBanco[banco.id][keyMes] = { total: 0, items: [] };
            }
            faturasPorBanco[banco.id][keyMes].total += valorParcela;
            faturasPorBanco[banco.id][keyMes].items.push({
                compraId: compra.id, 
                descricao: compra.descricao,
                tagId: compra.tagId, 
                htmlTag: htmlTag,
                dataStr: `${String(diaCompra).padStart(2,'0')}/${String(dataCompra.getMonth()+1).padStart(2,'0')}`,
                parcelaStr: compra.tipo === 'parcelado' ? `(Parcela ${i + 1}/${qtdParcelas})` : '(À vista)',
                valor: valorParcela,
                timestamp: timestampCompra
            });
        }
    });

    return faturasPorBanco;
};

// --- RENDERIZAR GRÁFICO DE TAGS (INTELIGENTE E RESPONSIVO) ---
const renderizarGraficoTags = () => {
    const ctx = document.getElementById('tagsChart');
    if(!ctx) return;

    const isMobile = window.innerWidth <= 768;

    const faturasPorBanco = processarFaturas();
    const totaisPorTag = {};
    
    tags.forEach(t => { totaisPorTag[t.id] = { nome: t.nome, cor: t.cor, total: 0, proxima: 0 }; });
    totaisPorTag['sem_tag'] = { nome: 'Sem Tag', cor: '#cbd5e1', total: 0, proxima: 0 };

    let temGastoAberto = false;

    bancos.forEach(banco => {
        const faturasDoBanco = faturasPorBanco[banco.id] || {};
        const chavesBanco = Object.keys(faturasDoBanco).sort();
        let keyProximaFatura = null;

        chavesBanco.forEach(keyMes => {
            const faturaKey = `${banco.id}_${keyMes}`;
            const info = faturasInfo[faturaKey] || { status: 'aberto', pago: 0 };
            const faturaObj = faturasDoBanco[keyMes];
            const totalReal = faturaObj.total || 0;
            const pagoValor = parseFloat(info.pago) || 0;
            const valorAberto = info.status === 'pago' ? 0 : Math.max(0, totalReal - pagoValor);

            if (info.status !== 'pago' && valorAberto > 0 && !keyProximaFatura) {
                keyProximaFatura = keyMes;
            }
        });

        chavesBanco.forEach(keyMes => {
            const faturaKey = `${banco.id}_${keyMes}`;
            const info = faturasInfo[faturaKey] || { status: 'aberto', pago: 0 };
            const faturaObj = faturasDoBanco[keyMes];
            const totalReal = faturaObj.total || 0;
            const pagoValor = parseFloat(info.pago) || 0;
            const valorAberto = info.status === 'pago' ? 0 : Math.max(0, totalReal - pagoValor);

            if (info.status !== 'pago' && valorAberto > 0 && totalReal > 0) {
                const proporcao = valorAberto / totalReal; 
                const isProxima = (keyMes === keyProximaFatura);

                faturaObj.items.forEach(item => {
                    const tagId = item.tagId || 'sem_tag';
                    const valorItemAberto = item.valor * proporcao;

                    if (totaisPorTag[tagId]) {
                        totaisPorTag[tagId].total += valorItemAberto;
                        if (isProxima) {
                            totaisPorTag[tagId].proxima += valorItemAberto;
                        }
                        temGastoAberto = true;
                    }
                });
            }
        });
    });

    const labels = [];
    const dataTotal = [];
    const dataProxima = [];
    const bgColors = [];
    let legendMobileHtml = '';

    Object.values(totaisPorTag).forEach(t => {
        if (t.total > 0) {
            labels.push(t.nome);
            dataTotal.push(t.total); 
            dataProxima.push(t.proxima);
            bgColors.push(t.cor);

            legendMobileHtml += `
                <div class="legend-item-mobile">
                    <div class="legend-color-box" style="background-color: ${t.cor}"></div>
                    <div class="legend-info-mobile">
                        <strong>${t.nome}</strong>
                        <span>Próxima Fatura: <b>${formatarMoeda(t.proxima)}</b></span>
                        <span>Valor Total Pendente: <b>${formatarMoeda(t.total)}</b></span>
                    </div>
                </div>
            `;
        }
    });

    const legendContainer = document.getElementById('tags-legend-mobile');
    if (legendContainer) {
        legendContainer.innerHTML = legendMobileHtml;
    }

    if (tagsChartInstance) {
        tagsChartInstance.destroy();
    }

    if (!temGastoAberto) {
        tagsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Tudo Pago / Sem Gastos Ativos'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }
        });
        return;
    }

    tagsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataTotal,
                dataProxima: dataProxima,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: isMobile ? 0 : 4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            events: isMobile ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
            plugins: {
                legend: { 
                    display: !isMobile, 
                    position: 'right', 
                    labels: { font: { family: 'Inter' }, color: '#64748b' } 
                },
                tooltip: {
                    enabled: !isMobile, 
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    titleFont: { family: 'Inter', size: 14 },
                    bodyFont: { family: 'Inter', size: 13, weight: '500' },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const total = context.parsed;
                            const proxima = context.dataset.dataProxima[index];
                            return [
                                ` Próxima Fatura: ${formatarMoeda(proxima)}`,
                                ` Valor Total Pendente: ${formatarMoeda(total)}`
                            ];
                        }
                    }
                }
            }
        }
    });
};

const renderizarDashboard = () => {
    const faturasPorBanco = processarFaturas();
    
    let somaDividaTotalAberta = 0;
    let somaProximoMesAberto = 0;
    
    const dataHoje = new Date();
    const dataHojeLimpa = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), dataHoje.getDate(), 0, 0, 0);
    
    const objProximoMes = new Date();
    objProximoMes.setMonth(objProximoMes.getMonth() + 1);
    const keyProximoMesTarget = `${objProximoMes.getFullYear()}-${String(objProximoMes.getMonth() + 1).padStart(2, '0')}`;

    if (listaBancosFaturas) listaBancosFaturas.innerHTML = '';
    if (bancosCarrosselContainer) bancosCarrosselContainer.innerHTML = '';

    bancos.forEach(banco => {
        const faturasDoBanco = faturasPorBanco[banco.id] || {};
        const chavesBanco = Object.keys(faturasDoBanco).sort();

        let htmlFaturasAbertas = '';
        let htmlFaturasPagas = '';
        let htmlFaturasFuturas = '';
        
        let qtdAbertas = 0;
        let qtdPagas = 0;
        let qtdFuturas = 0;
        
        let totalBancoAberto = 0;
        let achouFaturaAtual = false;
        
        let valorProximaFatura = 0;
        let achouProximaFaturaValor = false;
        let textoMesProximaFatura = 'Sem faturas';

        if (chavesBanco.length === 0) {
            htmlFaturasAbertas = '<p style="color: var(--text-muted); width: 100%; text-align: center; padding: 2rem; grid-column: 1 / -1;">Nenhum gasto registrado neste cartão.</p>';
        } else {
            chavesBanco.forEach(keyMes => {
                const faturaKey = `${banco.id}_${keyMes}`;
                if (!faturasInfo[faturaKey]) faturasInfo[faturaKey] = { status: 'aberto', pago: 0 };
                const info = faturasInfo[faturaKey];

                const faturaObj = faturasDoBanco[keyMes];
                const totalReal = faturaObj.total || 0;
                const pagoValor = parseFloat(info.pago) || 0;
                const valorAberto = info.status === 'pago' ? 0 : Math.max(0, totalReal - pagoValor);

                const [anoStr, mesStr] = keyMes.split('-');
                const ano = parseInt(anoStr);
                const mes = parseInt(mesStr);
                const v = parseInt(banco.vencimento);
                const f = parseInt(banco.fechamento) || v;

                const dataVencimento = new Date(ano, mes - 1, v, 23, 59, 59);
                let dataFechamento;
                if (f > v) {
                    dataFechamento = new Date(ano, mes - 2, f, 0, 0, 0);
                } else {
                    dataFechamento = new Date(ano, mes - 1, f, 0, 0, 0);
                }

                if (dataHojeLimpa <= dataVencimento) {
                    somaDividaTotalAberta += valorAberto;
                }

                if (info.status !== 'pago') {
                    totalBancoAberto += valorAberto; 
                    if (!achouProximaFaturaValor && valorAberto > 0) {
                        valorProximaFatura = valorAberto;
                        const nomeMesAbrev = nomeMeses[mes - 1].substring(0, 3);
                        textoMesProximaFatura = `${nomeMesAbrev}/${anoStr.substring(2,4)}`;
                        achouProximaFaturaValor = true;
                    }
                }

                if (keyMes === keyProximoMesTarget) {
                    somaProximoMesAberto += valorAberto;
                }

                let statusTag = '';
                let categoriaFatura = ''; 

                if (info.status === 'pago') {
                    statusTag = '<span class="badge badge-pago">✅ Paga</span>';
                    categoriaFatura = 'pagas';
                } else if (dataHojeLimpa > dataVencimento) {
                    statusTag = `<span class="badge badge-atrasada">❌ Atrasada (Dia ${v})</span>`;
                    categoriaFatura = 'abertas';
                } else if (dataHojeLimpa >= dataFechamento) {
                    statusTag = `<span class="badge badge-prestes">⚠️ Prestes a vencer</span>`;
                    categoriaFatura = 'abertas';
                } else {
                    statusTag = `<span class="badge badge-emdia">⏳ Em dia</span>`;
                    if (!achouFaturaAtual) {
                        achouFaturaAtual = true;
                        categoriaFatura = 'abertas';
                    } else {
                        categoriaFatura = 'futuras';
                    }
                }

                if (faturaObj && Array.isArray(faturaObj.items)) {
                    faturaObj.items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                }

                let itensHtml = faturaObj.items.map(item => `
                    <div class="fatura-item">
                        <div class="item-desc">
                            <span>${item.descricao || 'Sem descrição'} ${item.htmlTag || ''} <small style="margin-left:5px">(${item.dataStr})</small></span>
                            <small>${item.parcelaStr}</small>
                        </div>
                        <div class="item-direita">
                            <span class="item-valor">${formatarMoeda(item.valor)}</span>
                            <div class="item-acoes">
                                <button type="button" class="btn-icon edit" onclick="abrirModalEditarCompra('${item.compraId}')" title="Editar Compra">✏️</button>
                                <button type="button" class="btn-icon delete" onclick="excluirCompra('${item.compraId}')" title="Excluir Compra">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('');

                let acoesHtml = '';
                if (info.status === 'pago') {
                    acoesHtml = `
                        <div class="fatura-acoes" style="justify-content: flex-end;">
                            <button class="btn-desfazer" onclick="desfazerPagamento('${banco.id}', '${keyMes}')">Desfazer Pagamento</button>
                        </div>
                    `;
                } else {
                    let btnCorrigir = '';
                    if (pagoValor > 0) {
                        btnCorrigir = `<button class="btn-corrigir-abatimento" onclick="abrirModalEditarAbatimento('${banco.id}', '${keyMes}')">✏️ Corrigir Valor Abatido</button>`;
                    }

                    acoesHtml = `
                        <div class="fatura-acoes">
                            <div class="pagamento-parcial">
                                <input type="number" id="input-pgto-${banco.id}-${keyMes}" placeholder="R$ Abater" step="0.01" min="0.01">
                                <button class="btn-abater" onclick="abaterValor('${banco.id}', '${keyMes}')">⬇️ Abater</button>
                            </div>
                            ${btnCorrigir}
                            <button class="btn-pago-total" onclick="marcarComoPago('${banco.id}', '${keyMes}')">✅ Marcar Fatura Paga</button>
                        </div>
                    `;
                }

                let faturaHtmlCompleta = `
                    <div class="fatura-mes">
                        <div class="fatura-mes-header">
                            <div class="header-info">
                                <span>${formatarMesAno(keyMes)}</span>
                                ${statusTag}
                            </div>
                        </div>
                        
                        <div class="fatura-itens">
                            ${itensHtml}
                        </div>

                        <div class="fatura-totais">
                            <span>Total:<br><strong>${formatarMoeda(totalReal)}</strong></span>
                            <span class="txt-pago">Pago:<br><strong>${formatarMoeda(pagoValor)}</strong></span>
                            <span class="txt-aberto">A Pagar:<br><strong>${formatarMoeda(valorAberto)}</strong></span>
                        </div>

                        ${acoesHtml}
                    </div>
                `;

                if (categoriaFatura === 'pagas') {
                    htmlFaturasPagas += faturaHtmlCompleta;
                    qtdPagas++;
                } else if (categoriaFatura === 'abertas') {
                    htmlFaturasAbertas += faturaHtmlCompleta;
                    qtdAbertas++;
                } else if (categoriaFatura === 'futuras') {
                    htmlFaturasFuturas += faturaHtmlCompleta;
                    qtdFuturas++;
                }
            });
        }

        if (bancosCarrosselContainer) {
            const cardResumo = document.createElement('div');
            cardResumo.className = 'banco-resumo-card';
            cardResumo.onclick = () => {
                const elem = document.getElementById(`detalhe-banco-${banco.id}`);
                if(elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            
            cardResumo.innerHTML = `
                <h3>💳 ${banco.nome}</h3>
                <div class="info-linha" style="margin-bottom: 1rem;">
                    <span>Fechamento: Dia ${banco.fechamento || banco.vencimento}</span>
                    <span>Venc: Dia ${banco.vencimento}</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1.2rem;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Próxima Fatura (${textoMesProximaFatura})</span>
                    <span class="info-valor" style="color: var(--brand-primary); font-size: 1.8rem; line-height: 1;">${formatarMoeda(valorProximaFatura)}</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 0.8rem;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Total Utilizado</span>
                    <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">${formatarMoeda(totalBancoAberto)}</span>
                </div>
            `;
            bancosCarrosselContainer.appendChild(cardResumo);
        }

        if (listaBancosFaturas) {
            let conteudoBody = '';
            
            if (qtdAbertas > 0 || chavesBanco.length === 0) {
                conteudoBody += `<div class="faturas-container">${htmlFaturasAbertas}</div>`;
            } else if (qtdAbertas === 0 && (qtdPagas > 0 || qtdFuturas > 0)) {
                conteudoBody += `<p style="color: var(--success); font-weight: 600; margin-bottom: 1rem; background: var(--success-light); padding: 1rem; border-radius: var(--radius-md);">🎉 Tudo certo! Nenhuma fatura atual em aberto cobrando no momento.</p>`;
            }

            if (qtdFuturas > 0) {
                conteudoBody += `
                    <div class="toggle-faturas-wrapper">
                        <button class="btn-toggle-faturas" onclick="toggleFaturas('${banco.id}', 'futuras')">
                            <span>⏳ Faturas Futuras Ocultas (${qtdFuturas})</span>
                            <span class="setinha" id="seta-futuras-${banco.id}">▼</span>
                        </button>
                        <div id="container-futuras-${banco.id}" class="faturas-secundarias-container hidden">
                            <div class="faturas-container">
                                ${htmlFaturasFuturas}
                            </div>
                        </div>
                    </div>
                `;
            }

            if (qtdPagas > 0) {
                conteudoBody += `
                    <div class="toggle-faturas-wrapper">
                        <button class="btn-toggle-faturas" onclick="toggleFaturas('${banco.id}', 'pagas')">
                            <span>✅ Faturas Pagas Ocultas (${qtdPagas})</span>
                            <span class="setinha" id="seta-pagas-${banco.id}">▼</span>
                        </button>
                        <div id="container-pagas-${banco.id}" class="faturas-secundarias-container hidden">
                            <div class="faturas-container">
                                ${htmlFaturasPagas}
                            </div>
                        </div>
                    </div>
                `;
            }

            const bancoCard = document.createElement('div');
            bancoCard.className = 'banco-card';
            bancoCard.id = `detalhe-banco-${banco.id}`; 
            
            bancoCard.innerHTML = `
                <div class="banco-header">
                    <div class="banco-info-toggle" onclick="toggleBanco('${banco.id}')" title="Ocultar/Mostrar Cartão">
                        <span class="setinha-banco" id="seta-banco-${banco.id}" style="transform: rotate(180deg);">▼</span>
                        <div class="banco-info">
                            <span>${banco.nome}</span>
                            <small>Fechamento: Dia ${banco.fechamento || banco.vencimento} | Vencimento: Dia ${banco.vencimento}</small>
                        </div>
                    </div>
                    <button class="btn-editar" onclick="abrirModalEditarBanco('${banco.id}')">✏️ Editar Cartão</button>
                </div>
                <div class="banco-body" id="body-banco-${banco.id}">
                    ${conteudoBody}
                </div>
            `;
            listaBancosFaturas.appendChild(bancoCard);
        }
    });

    if (valorDividaTotal) valorDividaTotal.textContent = formatarMoeda(somaDividaTotalAberta);
    if (labelProximoMes) labelProximoMes.textContent = `Restante de ${nomeMeses[objProximoMes.getMonth()]} / ${objProximoMes.getFullYear()}`;
    if (valorProximoMes) valorProximoMes.textContent = formatarMoeda(somaProximoMesAberto);
};

// Sincronização automática e segura na Nuvem do Firebase Firestore
const salvarEAtualizar = async () => {
    const faturasValidas = new Set();
    const faturasAtuais = processarFaturas();
    
    bancos.forEach(b => {
        if(faturasAtuais[b.id]) {
            Object.keys(faturasAtuais[b.id]).forEach(keyMes => {
                faturasValidas.add(`${b.id}_${keyMes}`);
            });
        }
    });
    
    Object.keys(faturasInfo).forEach(key => {
        if (!faturasValidas.has(key)) {
            delete faturasInfo[key];
        }
    });

    try {
        await setDoc(doc(db, "sistema", "dados"), { bancos, compras, faturasInfo, tags });
        atualizarSelects();
        renderizarDashboard();
        renderizarGraficoTags(); 
    } catch (e) {
        console.error("Erro Crítico ao Salvar no Firebase:", e);
        alert("⚠️ Erro ao salvar dados na nuvem. Verifique sua conexão com a internet.");
    }
};

// --- FUNÇÕES GERAIS DE MODAIS ---
window.fecharModal = (idModal) => {
    const m = document.getElementById(idModal);
    if(m) m.classList.add('hidden');
};

// --- AÇÕES DE TAGS ---
window.abrirModalNovaTag = () => {
    document.getElementById('modal-nova-tag').classList.remove('hidden');
};

const formNovaTag = document.getElementById('form-nova-tag');
if (formNovaTag) {
    formNovaTag.addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = document.getElementById('nome-tag').value;
        const cor = document.getElementById('cor-tag').value;

        const novaTag = { id: Date.now().toString(), nome, cor };
        tags.push(novaTag);
        
        formNovaTag.reset();
        document.getElementById('cor-tag').value = "#7b00ff";
        
        salvarEAtualizar();
        fecharModal('modal-nova-tag');
        
        if(selectTag) selectTag.value = novaTag.id;
    });
}

// --- AÇÕES DE PAGAMENTO E TOGGLES ---
window.abaterValor = (bancoId, keyMes) => {
    const idInput = `input-pgto-${bancoId}-${keyMes}`;
    const inputValor = document.getElementById(idInput);
    if(!inputValor) return;
    
    const valorDigitado = parseFloat(inputValor.value);
    if(isNaN(valorDigitado) || valorDigitado <= 0) {
        alert('Digite um valor válido maior que zero para abater.');
        return;
    }

    const faturaKey = `${bancoId}_${keyMes}`;
    if (!faturasInfo[faturaKey]) faturasInfo[faturaKey] = { status: 'aberto', pago: 0 };
    faturasInfo[faturaKey].pago = (parseFloat(faturasInfo[faturaKey].pago) || 0) + valorDigitado;
    salvarEAtualizar();
};

window.abrirModalEditarAbatimento = (bancoId, keyMes) => {
    const faturaKey = `${bancoId}_${keyMes}`;
    const info = faturasInfo[faturaKey] || { pago: 0 };
    
    document.getElementById('edit-banco-id-abat').value = bancoId;
    document.getElementById('edit-key-mes-abat').value = keyMes;
    document.getElementById('edit-valor-abat').value = info.pago || 0;
    
    document.getElementById('modal-editar-abatimento').classList.remove('hidden');
};

const formEditarAbatimento = document.getElementById('form-editar-abatimento');
if (formEditarAbatimento) {
    formEditarAbatimento.addEventListener('submit', (e) => {
        e.preventDefault();
        const bancoId = document.getElementById('edit-banco-id-abat').value;
        const keyMes = document.getElementById('edit-key-mes-abat').value;
        const novoValor = parseFloat(document.getElementById('edit-valor-abat').value);
        
        if (bancoId && keyMes && !isNaN(novoValor)) {
            const faturaKey = `${bancoId}_${keyMes}`;
            if (!faturasInfo[faturaKey]) faturasInfo[faturaKey] = { status: 'aberto', pago: 0 };
            
            faturasInfo[faturaKey].pago = novoValor;
            
            if (novoValor === 0 && faturasInfo[faturaKey].status !== 'pago') {
                faturasInfo[faturaKey].pago = 0;
            }
            
            salvarEAtualizar();
            fecharModal('modal-editar-abatimento');
        }
    });
}

window.marcarComoPago = (bancoId, keyMes) => {
    const faturaKey = `${bancoId}_${keyMes}`;
    if (!faturasInfo[faturaKey]) faturasInfo[faturaKey] = { status: 'aberto', pago: 0 };
    faturasInfo[faturaKey].status = 'pago';
    salvarEAtualizar();
};

window.desfazerPagamento = (bancoId, keyMes) => {
    const faturaKey = `${bancoId}_${keyMes}`;
    if (!faturasInfo[faturaKey]) faturasInfo[faturaKey] = { status: 'aberto', pago: 0 };
    faturasInfo[faturaKey].status = 'aberto';
    faturasInfo[faturaKey].pago = 0; 
    salvarEAtualizar();
};

window.toggleFaturas = (bancoId, tipo) => {
    const container = document.getElementById(`container-${tipo}-${bancoId}`);
    const seta = document.getElementById(`seta-${tipo}-${bancoId}`);
    if (container && seta) {
        if (container.classList.contains('hidden')) {
            container.classList.remove('hidden');
            seta.style.transform = 'rotate(180deg)';
        } else {
            container.classList.add('hidden');
            seta.style.transform = 'rotate(0deg)';
        }
    }
};

window.toggleBanco = (bancoId) => {
    const body = document.getElementById(`body-banco-${bancoId}`);
    const seta = document.getElementById(`seta-banco-${bancoId}`);
    if (body && seta) {
        if (body.classList.contains('hidden')) {
            body.classList.remove('hidden');
            seta.style.transform = 'rotate(180deg)';
        } else {
            body.classList.add('hidden');
            seta.style.transform = 'rotate(0deg)';
        }
    }
};

// --- AÇÕES DO BANCO ---
if (formBanco) {
    formBanco.addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = document.getElementById('nome-banco').value;
        const fechamento = document.getElementById('fechamento-banco').value;
        const vencimento = document.getElementById('vencimento-banco').value;

        bancos.push({ id: Date.now().toString(), nome, fechamento, vencimento });
        formBanco.reset();
        salvarEAtualizar();
    });
}

window.abrirModalEditarBanco = (id) => {
    const banco = bancos.find(b => b.id === id);
    if(banco) {
        document.getElementById('edit-id-banco').value = banco.id;
        document.getElementById('edit-nome-banco').value = banco.nome;
        document.getElementById('edit-fechamento-banco').value = banco.fechamento || banco.vencimento;
        document.getElementById('edit-vencimento-banco').value = banco.vencimento;
        document.getElementById('modal-editar-banco').classList.remove('hidden');
    }
};

const formEditarBanco = document.getElementById('form-editar-banco');
if (formEditarBanco) {
    formEditarBanco.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id-banco').value;
        const bancoIndex = bancos.findIndex(b => b.id === id);
        
        if(bancoIndex > -1) {
            bancos[bancoIndex].nome = document.getElementById('edit-nome-banco').value;
            bancos[bancoIndex].fechamento = document.getElementById('edit-fechamento-banco').value;
            bancos[bancoIndex].vencimento = document.getElementById('edit-vencimento-banco').value;
            salvarEAtualizar();
            fecharModal('modal-editar-banco');
        }
    });
}

// --- AÇÕES DE COMPRA ---
if (formCompra) {
    formCompra.addEventListener('submit', (e) => {
        e.preventDefault();
        const descricao = document.getElementById('desc-compra').value;
        const valor = parseFloat(document.getElementById('valor-compra').value);
        const data = document.getElementById('data-compra').value;
        const bancoId = document.getElementById('select-banco').value;
        const tipo = document.getElementById('tipo-pagamento').value;
        const tagId = document.getElementById('select-tag').value; 
        let parcelas = parseInt(document.getElementById('parcelas-compra').value) || 1;

        if (parcelas > 480) parcelas = 480; 

        compras.push({
            id: Date.now().toString(),
            descricao, valor, data, bancoId, tipo, tagId,
            parcelas: parcelas
        });
        
        formCompra.reset();
        if(tipoPagamento) tipoPagamento.dispatchEvent(new Event('change'));
        salvarEAtualizar();
    });
}

window.excluirCompra = (compraId) => {
    if(confirm('Tem certeza que deseja excluir esta compra? Isso removerá as parcelas de todas as faturas.')){
        compras = compras.filter(c => c.id !== compraId);
        salvarEAtualizar();
    }
};

window.abrirModalEditarCompra = (compraId) => {
    const compra = compras.find(c => c.id === compraId);
    if(compra) {
        document.getElementById('edit-id-compra').value = compra.id;
        document.getElementById('edit-desc-compra').value = compra.descricao;
        document.getElementById('edit-valor-compra').value = compra.valor;
        document.getElementById('edit-data-compra').value = compra.data;
        document.getElementById('edit-select-banco').value = compra.bancoId;
        document.getElementById('edit-select-tag').value = compra.tagId || ""; 
        
        const selectTipo = document.getElementById('edit-tipo-pagamento');
        if(selectTipo) {
            selectTipo.value = compra.tipo;
            selectTipo.dispatchEvent(new Event('change')); 
        }
        
        if(compra.tipo === 'parcelado') {
            document.getElementById('edit-parcelas-compra').value = compra.parcelas;
        }
        
        document.getElementById('modal-editar-compra').classList.remove('hidden');
    }
};

const formEditarCompra = document.getElementById('form-editar-compra');
if (formEditarCompra) {
    formEditarCompra.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id-compra').value;
        const compraIndex = compras.findIndex(c => c.id === id);
        
        if(compraIndex > -1) {
            compras[compraIndex].descricao = document.getElementById('edit-desc-compra').value;
            compras[compraIndex].valor = parseFloat(document.getElementById('edit-valor-compra').value);
            compras[compraIndex].data = document.getElementById('edit-data-compra').value;
            compras[compraIndex].bancoId = document.getElementById('edit-select-banco').value;
            compras[compraIndex].tagId = document.getElementById('edit-select-tag').value; 
            compras[compraIndex].tipo = document.getElementById('edit-tipo-pagamento').value;
            
            let parcelas = parseInt(document.getElementById('edit-parcelas-compra').value) || 1;
            if (parcelas > 480) parcelas = 480;

            compras[compraIndex].parcelas = compras[compraIndex].tipo === 'parcelado' ? parcelas : 1;
            
            salvarEAtualizar();
            fecharModal('modal-editar-compra');
        }
    });
}

// --- EXPORTAR DADOS ---
if (btnExportar) {
    btnExportar.addEventListener('click', () => {
        if (bancos.length === 0 && compras.length === 0) {
            alert("Não há dados para exportar.");
            return;
        }
        const dataToExport = { bancos, compras, faturasInfo, tags };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        
        const dateStr = new Date().toISOString().split('T')[0];
        downloadAnchorNode.setAttribute("download", `controle_financeiro_backup_${dateStr}.json`);
        
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
}

// --- IMPORTAR JSON DIRETAMENTE PARA A NUVEM ---
if (btnImportar) {
    btnImportar.addEventListener('click', () => {
        if (!inputImportar) return;
        const file = inputImportar.files[0];
        if (!file) {
            alert('Por favor, selecione um arquivo .json para importar.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                if (importedData.bancos && Array.isArray(importedData.bancos) && importedData.compras && Array.isArray(importedData.compras)) {
                    if(confirm('Deseja importar estes dados e enviá-los para a nuvem?')) {
                        bancos = importedData.bancos;
                        compras = importedData.compras;
                        faturasInfo = importedData.faturasInfo || {};
                        tags = importedData.tags || []; 
                        
                        await salvarEAtualizar();
                        alert('Dados importados e salvos na nuvem com sucesso!');
                        inputImportar.value = '';
                    }
                } else {
                    alert('Arquivo inválido. Formato incorreto.');
                }
            } catch (e) {
                alert('Erro ao ler o arquivo.');
            }
        };
        reader.readAsText(file);
    });
}

// --- INICIALIZAÇÃO DO SISTEMA VIA NUVEM (FIREBASE) ---
const carregarDadosDoFirebase = async () => {
    try {
        const docRef = doc(db, "sistema", "dados");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dados = docSnap.data();
            bancos = dados.bancos || [];
            compras = dados.compras || [];
            faturasInfo = dados.faturasInfo || {};
            tags = dados.tags || [];
        }
    } catch (e) {
        console.error("Erro ao carregar dados do Firebase:", e);
    }
    atualizarSelects();
    renderizarDashboard();
    renderizarGraficoTags();
};

carregarDadosDoFirebase();

// Listener para redimensionar a tela 
window.addEventListener('resize', () => {
    clearTimeout(window.resizeGraficoTimer);
    window.resizeGraficoTimer = setTimeout(() => {
        renderizarGraficoTags();
    }, 250);
});