        const categoriasPadrão = ["Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Educação", "Investimentos", "Salário", "Outros"];
        
        let transactions = JSON.parse(localStorage.getItem('ironWallet_tx')) || [];
        let savingsGoal = parseFloat(localStorage.getItem('ironWallet_goal')) || 0;
        let chartInstance = null;

        // --- iniciar ---
        document.addEventListener('DOMContentLoaded', () => {
            populateCategories();
            document.getElementById('tx-date').valueAsDate = new Date();
            updateUI();
        });

        // --- sistema transações ---
        function addTransaction(e) {
            e.preventDefault();
            
            const desc = document.getElementById('tx-desc').value.trim();
            const amount = parseFloat(document.getElementById('tx-amount').value);
            const category = document.getElementById('tx-category').value;
            const type = document.getElementById('tx-type').value;
            const date = document.getElementById('tx-date').value;

            if(!desc || !amount || !date) {
                showToast("Preencha todos os campos.", "error");
                return;
            }

            const transaction = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                desc, amount, category, type, date
            };

            transactions.push(transaction);
            saveData();
            updateUI();
            closeModal('txModal');
            document.getElementById('tx-form').reset();
            document.getElementById('tx-date').valueAsDate = new Date();
            document.getElementById('tx-type').value = 'despesa'; // Reseta pro padrão
            showToast("Transação salva com sucesso!");
        }

        function deleteTransaction(id) {
            if(confirm("Excluir esta transação?")) {
                transactions = transactions.filter(t => t.id !== id);
                saveData();
                updateUI();
                showToast("Transação removida.");
            }
        }

        function filterTransactions() {
            const searchText = document.getElementById('search-tx').value.toLowerCase();
            const filterCat = document.getElementById('filter-category').value;

            const filtered = transactions.filter(t => {
                const matchDesc = t.desc.toLowerCase().includes(searchText);
                const matchCat = filterCat === 'all' || t.category === filterCat;
                return matchDesc && matchCat;
            });

            renderTable(filtered);
        }

        // --- render interface ---
        function updateUI() {
            filterTransactions(); // aplica filtros
            updateDashboard();
            updateChart();
            updateGoalProgress();
            generateSmartTips();
        }

        function renderTable(txData) {
            const list = document.getElementById('tx-list');
            list.innerHTML = '';
            
            const sorted = [...txData].sort((a, b) => new Date(b.date) - new Date(a.date));

            if(sorted.length === 0) {
                list.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); justify-content:center;">Sem registros.</td></tr>`;
                return;
            }

            sorted.forEach(t => {
                // fuso horário local
                const dateObj = new Date(t.date);
                dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
                const dateFormatted = dateObj.toLocaleDateString('pt-BR');
                const amountFormatted = formatCurrency(t.amount);
                const colorClass = t.type === 'receita' ? 'text-success' : 'text-danger';
                const sign = t.type === 'receita' ? '+' : '-';
                
                // data-label responsividade Mobile
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="Data">${dateFormatted}</td>
                    <td data-label="Descrição">${t.desc}</td>
                    <td data-label="Categoria"><span class="badge">${t.category}</span></td>
                    <td data-label="Valor" class="${colorClass}" style="font-weight: 500;">
                        ${sign} ${amountFormatted}
                    </td>
                    <td data-label="Ações" data-html2canvas-ignore="true" style="text-align: right;">
                        <button class="action-btn" onclick="deleteTransaction('${t.id}')" title="Excluir">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                `;
                list.appendChild(tr);
            });
        }

        function updateDashboard() {
            const receitas = transactions.filter(t => t.type === 'receita').reduce((acc, curr) => acc + curr.amount, 0);
            const despesas = transactions.filter(t => t.type === 'despesa').reduce((acc, curr) => acc + curr.amount, 0);
            const saldo = receitas - despesas;
            
            let economiaPercent = 0;
            if(receitas > 0) {
                economiaPercent = ((saldo / receitas) * 100).toFixed(1);
            }

            document.getElementById('saldo-total').textContent = formatCurrency(saldo);
            // cor saldo principal
            document.getElementById('saldo-total').className = 'stat-value ' + (saldo < 0 ? 'text-danger' : '');
            
            document.getElementById('receitas-total').textContent = formatCurrency(receitas);
            document.getElementById('despesas-total').textContent = formatCurrency(despesas);
            
            const ecoEl = document.getElementById('economia-total');
            ecoEl.textContent = `${economiaPercent}%`;
            if (economiaPercent < 0) ecoEl.className = 'stat-value text-danger';
            else if (economiaPercent > 20) ecoEl.className = 'stat-value text-success';
            else ecoEl.className = 'stat-value';
        }

        // --- CHART.JS ---
        function updateChart() {
            const ctx = document.getElementById('categoryChart').getContext('2d');
            
            const despesasMap = {};
            transactions.filter(t => t.type === 'despesa').forEach(t => {
                despesasMap[t.category] = (despesasMap[t.category] || 0) + t.amount;
            });

            const labels = Object.keys(despesasMap);
            const data = Object.values(despesasMap);
            
            // cores suaves
            const bgColors = [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
                '#8b5cf6', '#06b6d4', '#f43f5e', '#64748b', '#14b8a6'
            ];

            if(chartInstance) chartInstance.destroy();

            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.color = '#64748b';

            chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels.length > 0 ? labels : ['Sem despesas'],
                    datasets: [{
                        data: data.length > 0 ? data : [1],
                        backgroundColor: data.length > 0 ? bgColors : ['#e2e8f0'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { 
                            position: 'right',
                            labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } }
                        },
                        tooltip: {
                            backgroundColor: '#0f172a',
                            padding: 12,
                            cornerRadius: 8,
                            displayColors: false
                        }
                    }
                }
            });
        }

        // --- metas ---
        function setGoal(e) {
            e.preventDefault();
            const val = parseFloat(document.getElementById('goal-input').value);
            if(val >= 0) {
                savingsGoal = val;
                localStorage.setItem('ironWallet_goal', savingsGoal);
                updateGoalProgress();
                closeModal('goalModal');
                showToast("Meta salva!");
            }
        }

        function updateGoalProgress() {
            document.getElementById('goal-text').textContent = `Meta: ${formatCurrency(savingsGoal)}`;
            
            const receitas = transactions.filter(t => t.type === 'receita').reduce((acc, curr) => acc + curr.amount, 0);
            const despesas = transactions.filter(t => t.type === 'despesa').reduce((acc, curr) => acc + curr.amount, 0);
            const economiaAtual = receitas - despesas;

            let percentage = 0;
            if(savingsGoal > 0 && economiaAtual > 0) {
                percentage = Math.min((economiaAtual / savingsGoal) * 100, 100);
            }

            document.getElementById('goal-progress').style.width = `${percentage}%`;
            document.getElementById('goal-percent').textContent = `${percentage.toFixed(0)}%`;
        }

        // --- dicas inteligentes ---
        function generateSmartTips() {
            const container = document.getElementById('smart-tips');
            container.innerHTML = '';
            const tips = [];

            const receitas = transactions.filter(t => t.type === 'receita').reduce((acc, curr) => acc + curr.amount, 0);
            const despesas = transactions.filter(t => t.type === 'despesa').reduce((acc, curr) => acc + curr.amount, 0);
            
            if (receitas === 0 && despesas === 0) {
                tips.push("Comece adicionando suas receitas e despesas.");
            } else {
                if(despesas > receitas) {
                    tips.push("Atenção: Suas despesas ultrapassaram suas receitas este mês.");
                } else if(receitas > 0) {
                    const economia = receitas - despesas;
                    const perc = ((economia / receitas) * 100).toFixed(0);
                    if (perc >= 20) {
                        tips.push(`Excelente! Você poupou ${perc}% da sua renda.`);
                    } else {
                        tips.push(`Sua economia atual é de ${perc}%. Tente otimizar para chegar a 20%.`);
                    }
                }

                // dica categoria maior gasto
                const despesasMap = {};
                transactions.filter(t => t.type === 'despesa').forEach(t => {
                    despesasMap[t.category] = (despesasMap[t.category] || 0) + t.amount;
                });
                
                let maiorCat = '';
                let maiorValor = 0;
                for(const [cat, val] of Object.entries(despesasMap)) {
                    if(val > maiorValor) { maiorValor = val; maiorCat = cat; }
                }

                if(maiorCat && receitas > 0 && (maiorValor/receitas) > 0.3) {
                    tips.push(`Alerta: '${maiorCat}' consome mais de 30% da sua receita mensal.`);
                }
            }

            tips.forEach(t => {
                const div = document.createElement('div');
                div.className = 'tip-item';
                div.textContent = t;
                container.appendChild(div);
            });
        }

        // --- utilitarios ---
        function populateCategories() {
            const selects = [document.getElementById('tx-category'), document.getElementById('filter-category')];
            categoriasPadrão.forEach(cat => {
                selects[0].innerHTML += `<option value="${cat}">${cat}</option>`;
                selects[1].innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        }

        function formatCurrency(value) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        }

        function saveData() {
            localStorage.setItem('ironWallet_tx', JSON.stringify(transactions));
        }

        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }

        // fechar modal click fora
        window.onclick = function(event) {
            if (event.target.classList.contains('modal-overlay')) {
                event.target.classList.remove('active');
            }
        }

        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type === 'error' ? 'error' : ''}`;
            
            const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
            toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
            
            container.appendChild(toast);
            
            // força reflow animação
            void toast.offsetWidth;
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }

        // --- export PDF (em desenvolvimento) ---
function exportPDF() {

    showToast("Gerando PDF...", "success");

    const element = document.getElementById('app-content');

    document.body.classList.add('pdf-export-mode');

    const opt = {
        margin: 10,
        filename: 'Relatorio_IronWallet.pdf',

        image: {
            type: 'jpeg',
            quality: 1
        },

        html2canvas: {
            scale: 1,
            useCORS: true,
            scrollY: 0
        },

        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        },

        pagebreak: {
            mode: ['css']
        }
    };

    html2pdf()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
            document.body.classList.remove('pdf-export-mode');
            showToast("PDF gerado com sucesso!");
        })
        .catch((err) => {
            document.body.classList.remove('pdf-export-mode');
            console.error(err);
            showToast("Erro ao gerar PDF", "error");
        });
}
