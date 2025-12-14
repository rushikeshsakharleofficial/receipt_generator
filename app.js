/**
 * Receipt Generator Application
 * Professional receipt creation tool with live preview and database integration
 */

const API_BASE = window.location.origin;

class ReceiptGenerator {
    constructor() {
        this.items = [];
        this.zoom = 100;
        this.currencies = [];
        this.currentCurrency = { code: 'INR', symbol: '₹', rate: 1 };
        this.selectedCustomer = null;
        this.businessProfile = {
            business_name: 'My Business',
            address: '',
            phone: '',
            tax_id: '',
            footer_message: 'Thank you for your purchase!'
        };
        this.init();
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        this.setDefaultDateTime();
        this.generateReceiptNumber();
        await this.loadBusinessProfile();
        await this.loadCurrencies();
        this.addItem('', 1, 0);
        this.generateBarcode();
        this.updatePreview();
    }

    cacheElements() {
        // Customer
        this.customerSearch = document.getElementById('customerSearch');
        this.customerResults = document.getElementById('customerResults');
        this.selectedCustomerDiv = document.getElementById('selectedCustomer');
        this.selectedCustomerName = document.getElementById('selectedCustomerName');
        this.selectedCustomerDetails = document.getElementById('selectedCustomerDetails');
        this.clearCustomerBtn = document.getElementById('clearCustomer');
        this.customerId = document.getElementById('customerId');
        this.newCustomerFields = document.getElementById('newCustomerFields');
        this.newCustomerEmailField = document.getElementById('newCustomerEmailField');
        this.addNewCustomerBtn = document.getElementById('addNewCustomerBtn');
        this.customerName = document.getElementById('customerName');
        this.customerPhone = document.getElementById('customerPhone');
        this.customerEmail = document.getElementById('customerEmail');

        // Receipt Info
        this.receiptNumber = document.getElementById('receiptNumber'); // Actually removed from DOM, can remove this but keeping for safety if referenced
        this.receiptDate = document.getElementById('receiptDate');
        this.receiptTime = document.getElementById('receiptTime');
        this.currency = document.getElementById('currency');
        this.cashier = document.getElementById('cashier');

        // Items
        this.itemsContainer = document.getElementById('itemsContainer');
        this.addItemBtn = document.getElementById('addItemBtn');

        // Payment
        this.taxRate = document.getElementById('taxRate');
        this.discount = document.getElementById('discount');
        this.paymentMethod = document.getElementById('paymentMethod');
        this.amountPaid = document.getElementById('amountPaid');
        this.couponCode = document.getElementById('couponCode');
        this.applyCouponBtn = document.getElementById('applyCouponBtn');
        this.couponMessage = document.getElementById('couponMessage');

        // Actions
        this.saveAndDownloadBtn = document.getElementById('saveAndDownloadBtn');
        this.printBtn = document.getElementById('printBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.zoomInBtn = document.getElementById('zoomInBtn');
        this.zoomOutBtn = document.getElementById('zoomOutBtn');
        this.zoomLevel = document.getElementById('zoomLevel');

        // Preview Elements
        this.receipt = document.getElementById('receipt');
        this.previewBusinessName = document.getElementById('previewBusinessName');
        this.previewBusinessAddress = document.getElementById('previewBusinessAddress');
        this.previewBusinessPhone = document.getElementById('previewBusinessPhone');
        this.previewBusinessTax = document.getElementById('previewBusinessTax');
        this.previewReceiptNumber = document.getElementById('previewReceiptNumber');
        this.previewDate = document.getElementById('previewDate');
        this.previewTime = document.getElementById('previewTime');
        this.previewCashier = document.getElementById('previewCashier');
        this.previewCustomerRow = document.getElementById('previewCustomerRow');
        this.previewCustomer = document.getElementById('previewCustomer');
        this.previewItems = document.getElementById('previewItems');
        this.previewSubtotal = document.getElementById('previewSubtotal');
        this.previewDiscount = document.getElementById('previewDiscount');
        this.discountRow = document.getElementById('discountRow');
        this.previewTaxRate = document.getElementById('previewTaxRate');
        this.previewTax = document.getElementById('previewTax');
        this.previewTotal = document.getElementById('previewTotal');
        this.inrEquivRow = document.getElementById('inrEquivRow');
        this.previewTotalInr = document.getElementById('previewTotalInr');
        this.previewPaymentMethod = document.getElementById('previewPaymentMethod');
        this.previewAmountPaid = document.getElementById('previewAmountPaid');
        this.previewChange = document.getElementById('previewChange');
        this.previewFooter = document.getElementById('previewFooter');
        this.barcodeLines = document.getElementById('barcodeLines');
        this.barcodeNumber = document.getElementById('barcodeNumber');

        // Toast
        this.toast = document.getElementById('toast');
        this.toastMessage = document.getElementById('toastMessage');
    }

    bindEvents() {
        // Form input changes
        const inputs = [
            this.receiptDate, this.receiptTime, this.taxRate,
            this.discount, this.paymentMethod, this.amountPaid
        ];

        inputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.updatePreview());
                input.addEventListener('change', () => this.updatePreview());
            }
        });

        // Coupon
        this.applyCouponBtn.addEventListener('click', () => this.applyCoupon());
        this.couponCode.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.applyCoupon();
            }
        });

        // Currency change
        this.currency.addEventListener('change', () => {
            const option = this.currency.options[this.currency.selectedIndex];
            this.currentCurrency = {
                code: this.currency.value,
                symbol: option.dataset.symbol,
                rate: parseFloat(option.dataset.rate)
            };
            this.updatePreview();
        });

        // Receipt number change for barcode
        this.receiptNumber.addEventListener('input', () => this.generateBarcode());

        // Customer search
        let searchTimeout;
        this.customerSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.searchCustomers(e.target.value), 300);
        });

        this.customerSearch.addEventListener('focus', () => {
            if (this.customerSearch.value) {
                this.searchCustomers(this.customerSearch.value);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.customerSearch.contains(e.target) && !this.customerResults.contains(e.target)) {
                this.customerResults.style.display = 'none';
            }
        });

        this.clearCustomerBtn.addEventListener('click', () => this.clearCustomer());
        this.addNewCustomerBtn.addEventListener('click', () => this.toggleNewCustomerForm());

        // Add item button
        this.addItemBtn.addEventListener('click', () => {
            this.addItem('', 1, 0);
            this.updatePreview();
        });

        // Action buttons
        this.saveAndDownloadBtn.addEventListener('click', () => this.saveAndDownloadPDF());
        this.printBtn.addEventListener('click', () => this.print());
        this.resetBtn.addEventListener('click', () => this.reset());

        // Zoom controls
        this.zoomInBtn.addEventListener('click', () => this.setZoom(this.zoom + 10));
        this.zoomOutBtn.addEventListener('click', () => this.setZoom(this.zoom - 10));
    }

    async loadBusinessProfile() {
        try {
            const response = await fetch(`${API_BASE}/api/business-profile`);
            if (response.ok) {
                this.businessProfile = await response.json();
            }
        } catch (error) {
            console.log('Using default business profile (API not available)');
        }
    }

    async loadCurrencies() {
        try {
            const response = await fetch(`${API_BASE}/api/currencies`);
            if (response.ok) {
                this.currencies = await response.json();
                this.populateCurrencySelect();
            }
        } catch (error) {
            console.log('Using default currencies (API not available)');
        }
    }

    populateCurrencySelect() {
        this.currency.innerHTML = this.currencies.map(c =>
            `<option value="${c.code}" data-symbol="${c.symbol}" data-rate="${c.rate_to_inr}" ${c.code === 'INR' ? 'selected' : ''}>
                ${c.symbol} ${c.code} - ${c.name}
            </option>`
        ).join('');
    }

    async searchCustomers(query) {
        if (!query || query.length < 2) {
            this.customerResults.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/search/customers?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const customers = await response.json();
                this.showCustomerResults(customers);
            }
        } catch (error) {
            console.log('Customer search not available');
        }
    }

    showCustomerResults(customers) {
        if (customers.length === 0) {
            this.customerResults.innerHTML = '<div class="search-result-item no-results">No customers found</div>';
        } else {
            this.customerResults.innerHTML = customers.map(c => `
                <div class="search-result-item" data-id="${c.id}" data-name="${c.name}" data-phone="${c.phone || ''}" data-email="${c.email || ''}">
                    <span class="result-name">${c.name}</span>
                    <span class="result-details">${c.phone || ''} ${c.email ? `• ${c.email}` : ''}</span>
                </div>
            `).join('');

            this.customerResults.querySelectorAll('.search-result-item:not(.no-results)').forEach(item => {
                item.addEventListener('click', () => this.selectCustomer({
                    id: item.dataset.id,
                    name: item.dataset.name,
                    phone: item.dataset.phone,
                    email: item.dataset.email
                }));
            });
        }
        this.customerResults.style.display = 'block';
    }

    selectCustomer(customer) {
        this.selectedCustomer = customer;
        this.customerId.value = customer.id;
        this.selectedCustomerName.textContent = customer.name;
        this.selectedCustomerDetails.textContent = [customer.phone, customer.email].filter(Boolean).join(' • ');
        this.selectedCustomerDiv.style.display = 'flex';
        this.customerSearch.value = '';
        this.customerResults.style.display = 'none';
        this.hideNewCustomerForm();
        this.updatePreview();
    }

    clearCustomer() {
        this.selectedCustomer = null;
        this.customerId.value = '';
        this.selectedCustomerDiv.style.display = 'none';
        this.updatePreview();
    }

    toggleNewCustomerForm() {
        const isVisible = this.newCustomerFields.style.display !== 'none';
        if (isVisible) {
            this.hideNewCustomerForm();
        } else {
            this.showNewCustomerForm();
        }
    }

    showNewCustomerForm() {
        this.newCustomerFields.style.display = 'grid';
        this.newCustomerEmailField.style.display = 'block';
        this.addNewCustomerBtn.textContent = 'Cancel';
    }

    hideNewCustomerForm() {
        this.newCustomerFields.style.display = 'none';
        this.newCustomerEmailField.style.display = 'none';
        this.addNewCustomerBtn.textContent = '+ Add New Customer';
        this.customerName.value = '';
        this.customerPhone.value = '';
        this.customerEmail.value = '';
    }

    async createCustomer() {
        const name = this.customerName.value.trim();
        if (!name) {
            this.showToast('Please enter customer name', 'error');
            return null;
        }

        try {
            const response = await fetch(`${API_BASE}/api/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    phone: this.customerPhone.value.trim(),
                    email: this.customerEmail.value.trim()
                })
            });

            if (response.ok) {
                const customer = await response.json();
                this.selectCustomer(customer);
                this.showToast('Customer created successfully', 'success');
                return customer;
            } else {
                throw new Error('Failed to create customer');
            }
        } catch (error) {
            this.showToast('Failed to create customer', 'error');
            return null;
        }
    }

    setDefaultDateTime() {
        const now = new Date();

        // Set date
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        this.receiptDate.value = `${year}-${month}-${day}`;

        // Set time
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        this.receiptTime.value = `${hours}:${minutes}`;
    }

    generateReceiptNumber() {
        const now = new Date();
        const num = `RCP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        this.receiptNumber.value = num;
        this.generateBarcode();
    }

    addItem(description = '', quantity = 1, price = 0) {
        const id = Date.now();
        this.items.push({ id, description, quantity, price });
        this.renderItems();
    }

    removeItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.renderItems();
        this.updatePreview();
    }

    renderItems() {
        this.itemsContainer.innerHTML = this.items.map(item => `
            <div class="item-row" data-id="${item.id}">
                <input type="text" class="item-desc" value="${item.description}" placeholder="Item description">
                <input type="number" class="item-qty" value="${item.quantity}" min="1" step="1">
                <input type="number" class="item-price" value="${item.price}" min="0" step="0.01" placeholder="0.00">
                <button type="button" class="btn-remove" title="Remove item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // Bind events to new items
        this.itemsContainer.querySelectorAll('.item-row').forEach(row => {
            const id = parseInt(row.dataset.id);
            const item = this.items.find(i => i.id === id);

            row.querySelector('.item-desc').addEventListener('input', (e) => {
                item.description = e.target.value;
                this.updatePreview();
            });

            row.querySelector('.item-qty').addEventListener('input', (e) => {
                item.quantity = parseFloat(e.target.value) || 0;
                this.updatePreview();
            });

            row.querySelector('.item-price').addEventListener('input', (e) => {
                item.price = parseFloat(e.target.value) || 0;
                this.updatePreview();
            });

            row.querySelector('.btn-remove').addEventListener('click', () => {
                this.removeItem(id);
            });
        });
    }

    updatePreview() {
        const symbol = this.currentCurrency.symbol;

        // Business Info (from profile)
        this.previewBusinessName.textContent = this.businessProfile.business_name || 'BUSINESS NAME';
        this.previewBusinessAddress.textContent = this.businessProfile.address || '';
        this.previewBusinessPhone.textContent = this.businessProfile.phone ? `Tel: ${this.businessProfile.phone}` : '';
        this.previewBusinessTax.textContent = this.businessProfile.tax_id ? `GST: ${this.businessProfile.tax_id}` : '';

        // Receipt Info
        this.previewReceiptNumber.textContent = this.receiptNumber.value || '---';
        this.previewCashier.textContent = this.cashier.value || '---';

        // Customer
        if (this.selectedCustomer) {
            this.previewCustomerRow.style.display = 'flex';
            this.previewCustomer.textContent = this.selectedCustomer.name;
        } else {
            this.previewCustomerRow.style.display = 'none';
        }

        // Date formatting
        if (this.receiptDate.value) {
            const date = new Date(this.receiptDate.value);
            this.previewDate.textContent = date.toLocaleDateString('en-GB');
        }

        // Time formatting
        if (this.receiptTime.value) {
            const [hours, minutes] = this.receiptTime.value.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            this.previewTime.textContent = `${h12}:${minutes} ${ampm}`;
        }

        // Items
        this.previewItems.innerHTML = this.items
            .filter(item => item.description)
            .map(item => {
                const total = item.quantity * item.price;
                return `
                    <div class="receipt-item">
                        <span class="item-desc">${item.description}</span>
                        <span class="item-qty">${item.quantity}</span>
                        <span class="item-price">${symbol}${total.toFixed(2)}</span>
                    </div>
                `;
            }).join('');

        // Calculate totals
        const subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountAmount = parseFloat(this.discount.value) || 0;
        const taxRateValue = parseFloat(this.taxRate.value) || 0;
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * (taxRateValue / 100);
        const total = afterDiscount + taxAmount;
        const amountPaid = parseFloat(this.amountPaid.value) || 0;
        const change = amountPaid - total;

        // Update totals display
        this.previewSubtotal.textContent = `${symbol}${subtotal.toFixed(2)}`;

        if (discountAmount > 0) {
            this.discountRow.style.display = 'flex';
            this.previewDiscount.textContent = `-${symbol}${discountAmount.toFixed(2)}`;
        } else {
            this.discountRow.style.display = 'none';
        }

        this.previewTaxRate.textContent = taxRateValue;
        this.previewTax.textContent = `${symbol}${taxAmount.toFixed(2)}`;
        this.previewTotal.textContent = `${symbol}${total.toFixed(2)}`;

        // Show INR equivalent if different currency
        if (this.currentCurrency.code !== 'INR') {
            this.inrEquivRow.style.display = 'flex';
            const totalInr = total * this.currentCurrency.rate;
            this.previewTotalInr.textContent = `₹${totalInr.toFixed(2)}`;
        } else {
            this.inrEquivRow.style.display = 'none';
        }

        // Payment
        this.previewPaymentMethod.textContent = this.paymentMethod.value;
        this.previewAmountPaid.textContent = `${symbol}${amountPaid.toFixed(2)}`;
        this.previewChange.textContent = change >= 0 ? `${symbol}${change.toFixed(2)}` : `${symbol}0.00`;

        // Auto-fill amount paid if empty
        if (!this.amountPaid.value && total > 0) {
            this.amountPaid.placeholder = total.toFixed(2);
        }

        // Footer (from profile)
        const footerText = this.businessProfile.footer_message || 'Thank you for your purchase!';
        this.previewFooter.innerHTML = footerText.split('\n').map(line => `<p>${line}</p>`).join('');
    }

    generateBarcode() {
        const code = this.receiptNumber.value || 'RCP-000000';
        this.barcodeNumber.textContent = `*${code}*`;

        // Generate simple barcode pattern
        const barcodeString = code.replace(/[^a-zA-Z0-9]/g, '');
        let bars = '';

        for (let i = 0; i < 50; i++) {
            const charCode = barcodeString.charCodeAt(i % barcodeString.length) || 65;
            const width = (charCode % 3) + 1;
            const isBlack = i % 2 === 0;

            if (isBlack) {
                bars += `<div class="barcode-line" style="width: ${width}px;"></div>`;
            } else {
                bars += `<div style="width: ${width}px;"></div>`;
            }
        }

        this.barcodeLines.innerHTML = bars;
    }

    setZoom(level) {
        this.zoom = Math.min(Math.max(level, 50), 150);
        this.zoomLevel.textContent = `${this.zoom}%`;
        this.receipt.style.transform = `scale(${this.zoom / 100})`;
    }

    getReceiptData() {
        const subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discountAmount = parseFloat(this.discount.value) || 0;
        const taxRateValue = parseFloat(this.taxRate.value) || 0;
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * (taxRateValue / 100);
        const total = afterDiscount + taxAmount;
        const amountPaid = parseFloat(this.amountPaid.value) || total;
        const change = Math.max(0, amountPaid - total);

        // Generate receipt number if not present (although we try to keep it consistent via generateReceiptNumber)
        // Since we removed input, we use the value stored in the object property or regenerate
        const receiptNumber = this.receiptNumber.value || `RCP-${Date.now()}`;

        return {
            receipt_number: receiptNumber,
            customer_id: this.customerId.value || null,
            currency: this.currentCurrency.code,
            subtotal,
            coupon_code: this.couponCode.value.trim().toUpperCase() || null,
            discount: discountAmount,
            tax_rate: taxRateValue,
            tax_amount: taxAmount,
            total,
            payment_method: this.paymentMethod.value,
            amount_paid: amountPaid,
            change_amount: change,
            cashier: this.businessProfile?.cashier_name || 'Staff',
            items: this.items.filter(item => item.description).map(item => ({
                description: item.description,
                quantity: item.quantity,
                price: item.price
            }))
        };
    }

    async saveAndDownloadPDF() {
        // If new customer form is visible, create customer first
        if (this.newCustomerFields.style.display !== 'none' && this.customerName.value.trim()) {
            await this.createCustomer();
        }

        try {
            const receiptData = this.getReceiptData();

            const response = await fetch(`${API_BASE}/api/receipts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(receiptData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showToast('Receipt saved! Downloading PDF...', 'success');

                // Download PDF after save
                setTimeout(() => {
                    window.open(`${API_BASE}/api/receipts/${result.id}/pdf`, '_blank');
                    // Generate new receipt number for next receipt
                    this.generateReceiptNumber();
                    // Reset coupon
                    this.couponCode.value = '';
                    this.couponMessage.textContent = '';
                }, 500);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save receipt');
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to save receipt', 'error');
            console.error('Save error:', error);
        }
    }

    print() {
        window.print();
    }

    showToast(message, type = 'info') {
        this.toastMessage.textContent = message;
        this.toast.className = `toast show ${type}`;
        setTimeout(() => {
            this.toast.className = 'toast';
        }, 3000);
    }

    reset() {
        if (confirm('Are you sure you want to reset all fields?')) {
            // Reset customer
            this.clearCustomer();
            this.hideNewCustomerForm();

            // Reset receipt info
            this.generateReceiptNumber();
            this.setDefaultDateTime();
            this.currency.value = 'INR';
            this.currentCurrency = { code: 'INR', symbol: '₹', rate: 1 };

            // Reset items
            this.items = [];
            this.addItem('', 1, 0);

            // Reset payment
            this.taxRate.value = '18';
            this.discount.value = '0';
            this.paymentMethod.value = 'Cash';
            this.amountPaid.value = '';
            this.couponCode.value = '';
            this.couponMessage.textContent = '';
            this.discount.value = '0';
            this.paymentMethod.value = 'Cash';
            this.amountPaid.value = '';

            // Update preview
            this.generateBarcode();
            this.updatePreview();
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.receiptGenerator = new ReceiptGenerator();
});
