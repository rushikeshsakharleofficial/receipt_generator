/**
 * Receipt Generator Dashboard
 * Analytics and reporting interface
 */

const API_BASE = window.location.origin;

class Dashboard {
    constructor() {
        this.salesChart = null;
        this.currencyChart = null;
        this.paymentChart = null;
        this.currentPeriod = 'weekly';
        this.data = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // Chart period tabs
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.updateSalesChart();
            });
        });
    }

    async loadData() {
        try {
            const response = await fetch(`${API_BASE}/api/dashboard/stats`);
            if (response.ok) {
                this.data = await response.json();
                this.renderStats();
                this.renderCharts();
                this.renderTables();
            } else {
                console.error('Failed to load dashboard data');
            }
        } catch (error) {
            console.error('Dashboard error:', error);
            this.showError();
        }
    }

    formatCurrency(amount, symbol = '₹') {
        const num = parseFloat(amount) || 0;
        if (num >= 10000000) {
            return `${symbol}${(num / 10000000).toFixed(2)}Cr`;
        } else if (num >= 100000) {
            return `${symbol}${(num / 100000).toFixed(2)}L`;
        } else if (num >= 1000) {
            return `${symbol}${(num / 1000).toFixed(2)}K`;
        }
        return `${symbol}${num.toFixed(2)}`;
    }

    renderStats() {
        document.getElementById('totalCustomers').textContent = this.data.total_customers || 0;
        document.getElementById('totalReceipts').textContent = this.data.total_receipts || 0;
        document.getElementById('todaySales').textContent = this.formatCurrency(this.data.today_sales_inr);
        document.getElementById('weekSales').textContent = this.formatCurrency(this.data.week_sales_inr);
        document.getElementById('monthSales').textContent = this.formatCurrency(this.data.month_sales_inr);
        document.getElementById('yearSales').textContent = this.formatCurrency(this.data.year_sales_inr);
    }

    renderCharts() {
        this.renderSalesChart();
        this.renderCurrencyChart();
        this.renderPaymentChart();
    }

    getChartData() {
        switch (this.currentPeriod) {
            case 'weekly':
                return {
                    labels: (this.data.weekly_sales || []).map(d => {
                        const date = new Date(d.week_start);
                        return `Week ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
                    }),
                    data: (this.data.weekly_sales || []).map(d => parseFloat(d.total_sales) || 0)
                };
            case 'monthly':
                return {
                    labels: (this.data.monthly_sales || []).map(d => d.month_name || d.month),
                    data: (this.data.monthly_sales || []).map(d => parseFloat(d.total_sales) || 0)
                };
            case 'yearly':
                return {
                    labels: (this.data.yearly_sales || []).map(d => d.year.toString()),
                    data: (this.data.yearly_sales || []).map(d => parseFloat(d.total_sales) || 0)
                };
            default:
                return { labels: [], data: [] };
        }
    }

    renderSalesChart() {
        const ctx = document.getElementById('salesChart').getContext('2d');
        const chartData = this.getChartData();

        if (this.salesChart) {
            this.salesChart.destroy();
        }

        this.salesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Sales (INR)',
                    data: chartData.data,
                    backgroundColor: 'rgba(26, 26, 46, 0.8)',
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `₹${context.raw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `₹${value.toLocaleString('en-IN')}`
                        }
                    }
                }
            }
        });
    }

    updateSalesChart() {
        if (this.salesChart) {
            const chartData = this.getChartData();
            this.salesChart.data.labels = chartData.labels;
            this.salesChart.data.datasets[0].data = chartData.data;
            this.salesChart.update();
        }
    }

    renderCurrencyChart() {
        const ctx = document.getElementById('currencyChart').getContext('2d');
        const currencies = this.data.sales_by_currency || [];

        if (this.currencyChart) {
            this.currencyChart.destroy();
        }

        const colors = [
            '#1a1a2e', '#3d3d5c', '#5c5c8a', '#8080b3', '#a3a3cc',
            '#2d4a3d', '#4a6b5c', '#6b8c7a', '#8cad99', '#adceb8'
        ];

        this.currencyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: currencies.map(c => `${c.currency} (${c.currency_name || ''})`),
                datasets: [{
                    data: currencies.map(c => parseFloat(c.total_inr) || 0),
                    backgroundColor: colors.slice(0, currencies.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const currency = currencies[context.dataIndex];
                                return `${currency.symbol}${parseFloat(currency.total_original).toLocaleString()} (₹${context.raw.toLocaleString('en-IN')})`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderPaymentChart() {
        const ctx = document.getElementById('paymentChart').getContext('2d');
        const payments = this.data.sales_by_payment || [];

        if (this.paymentChart) {
            this.paymentChart.destroy();
        }

        const colors = ['#1a1a2e', '#3d5c4a', '#5c3d5c', '#5c5c3d', '#3d5c5c', '#5c3d3d'];

        this.paymentChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: payments.map(p => p.payment_method || 'Unknown'),
                datasets: [{
                    data: payments.map(p => parseFloat(p.total_inr) || 0),
                    backgroundColor: colors.slice(0, payments.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `₹${context.raw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        }
                    }
                }
            }
        });
    }

    renderTables() {
        this.renderTopCustomers();
        this.renderRecentReceipts();
    }

    renderTopCustomers() {
        const tbody = document.getElementById('topCustomersTable');
        const customers = this.data.top_customers || [];

        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No customer data available</td></tr>';
            return;
        }

        tbody.innerHTML = customers.map(c => `
            <tr>
                <td>
                    <div class="customer-cell">
                        <span class="customer-name">${c.name}</span>
                        <span class="customer-contact">${c.phone || c.email || ''}</span>
                    </div>
                </td>
                <td>${c.receipt_count}</td>
                <td class="amount">₹${parseFloat(c.total_spent_inr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('');
    }

    renderRecentReceipts() {
        const tbody = document.getElementById('recentReceiptsTable');
        const receipts = this.data.recent_receipts || [];

        if (receipts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No receipts yet</td></tr>';
            return;
        }

        tbody.innerHTML = receipts.map(r => {
            const date = new Date(r.created_at);
            const symbol = r.symbol || '₹';
            return `
                <tr>
                    <td><code>${r.receipt_number}</code></td>
                    <td>${r.customer_name || 'Walk-in'}</td>
                    <td class="amount">${symbol}${parseFloat(r.total).toFixed(2)}</td>
                    <td>${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                        <a href="/api/receipts/${r.id}/pdf" target="_blank" class="btn-action" title="View PDF">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/>
                            </svg>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showError() {
        document.querySelectorAll('.stat-value').forEach(el => {
            el.textContent = '-';
        });
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
