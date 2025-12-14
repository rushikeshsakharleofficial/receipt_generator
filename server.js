/**
 * Receipt Generator - Express Server
 * REST API for receipts and customer management
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'receipt_user',
    password: process.env.DB_PASSWORD || 'receipt_pass_2024',
    database: process.env.DB_NAME || 'receipt_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✓ Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('✗ Database connection failed:', error.message);
    }
}

// ==================== BUSINESS PROFILE ROUTES ====================

// Get business profile
app.get('/api/business-profile', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM business_profile LIMIT 1');
        if (rows.length === 0) {
            return res.json({
                business_name: 'My Business',
                address: '',
                phone: '',
                email: '',
                tax_id: '',
                website: '',
                footer_message: 'Thank you for your purchase!'
            });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching business profile:', error);
        res.status(500).json({ error: 'Failed to fetch business profile' });
    }
});

// Update business profile
app.put('/api/business-profile', async (req, res) => {
    try {
        const { business_name, address, phone, email, tax_id, website, footer_message } = req.body;

        // Check if profile exists
        const [existing] = await pool.query('SELECT id FROM business_profile LIMIT 1');

        if (existing.length > 0) {
            await pool.query(
                `UPDATE business_profile SET 
                    business_name = ?, address = ?, phone = ?, 
                    email = ?, tax_id = ?, website = ?, footer_message = ?
                 WHERE id = ?`,
                [business_name, address, phone, email, tax_id, website, footer_message, existing[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO business_profile 
                    (business_name, address, phone, email, tax_id, website, footer_message)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [business_name, address, phone, email, tax_id, website, footer_message]
            );
        }

        res.json({ message: 'Business profile updated successfully' });
    } catch (error) {
        console.error('Error updating business profile:', error);
        res.status(500).json({ error: 'Failed to update business profile' });
    }
});

// ==================== CUSTOMER ROUTES ====================

// Get all customers
app.get('/api/customers', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.*, 
                    COUNT(r.id) as total_receipts,
                    COALESCE(SUM(r.total), 0) as total_sales
             FROM customers c
             LEFT JOIN receipts r ON c.id = r.customer_id
             GROUP BY c.id
             ORDER BY c.name`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get customer by ID
app.get('/api/customers/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.*, 
                    COUNT(r.id) as total_receipts,
                    COALESCE(SUM(r.total), 0) as total_sales
             FROM customers c
             LEFT JOIN receipts r ON c.id = r.customer_id
             WHERE c.id = ?
             GROUP BY c.id`,
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create customer
app.post('/api/customers', async (req, res) => {
    try {
        const { name, phone, email, address } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        const [result] = await pool.query(
            'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
            [name, phone || '', email || '', address || '']
        );
        res.status(201).json({
            id: result.insertId,
            name,
            phone,
            email,
            address,
            message: 'Customer created successfully'
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer
app.put('/api/customers/:id', async (req, res) => {
    try {
        const { name, phone, email, address } = req.body;
        await pool.query(
            'UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?',
            [name, phone || '', email || '', address || '', req.params.id]
        );
        res.json({ message: 'Customer updated successfully' });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Get customer's receipts
app.get('/api/customers/:id/receipts', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM receipts WHERE customer_id = ? ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching customer receipts:', error);
        res.status(500).json({ error: 'Failed to fetch receipts' });
    }
});

// ==================== RECEIPT ROUTES ====================

// Get all receipts
app.get('/api/receipts', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT r.*, c.name as customer_name 
             FROM receipts r
             LEFT JOIN customers c ON r.customer_id = c.id
             ORDER BY r.created_at DESC
             LIMIT 100`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({ error: 'Failed to fetch receipts' });
    }
});

// Get receipt by ID with items
app.get('/api/receipts/:id', async (req, res) => {
    try {
        const [receipts] = await pool.query(
            `SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
             FROM receipts r
             LEFT JOIN customers c ON r.customer_id = c.id
             WHERE r.id = ?`,
            [req.params.id]
        );

        if (receipts.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        const [items] = await pool.query(
            'SELECT * FROM receipt_items WHERE receipt_id = ?',
            [req.params.id]
        );

        res.json({ ...receipts[0], items });
    } catch (error) {
        console.error('Error fetching receipt:', error);
        res.status(500).json({ error: 'Failed to fetch receipt' });
    }
});

// Get receipt by receipt number
app.get('/api/receipts/number/:receiptNumber', async (req, res) => {
    try {
        const [receipts] = await pool.query(
            `SELECT r.*, c.name as customer_name 
             FROM receipts r
             LEFT JOIN customers c ON r.customer_id = c.id
             WHERE r.receipt_number = ?`,
            [req.params.receiptNumber]
        );

        if (receipts.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        const [items] = await pool.query(
            'SELECT * FROM receipt_items WHERE receipt_id = ?',
            [receipts[0].id]
        );

        res.json({ ...receipts[0], items });
    } catch (error) {
        console.error('Error fetching receipt:', error);
        res.status(500).json({ error: 'Failed to fetch receipt' });
    }
});

// Create receipt
app.post('/api/receipts', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            receipt_number,
            customer_id,
            currency = 'INR',
            subtotal,
            coupon_code,
            discount,
            tax_rate,
            tax_amount,
            total,
            payment_method,
            amount_paid,
            change_amount,
            cashier,
            notes,
            items
        } = req.body;

        // Get currency rate for INR conversion
        const [[currencyData]] = await connection.query(
            'SELECT rate_to_inr FROM currencies WHERE code = ?',
            [currency]
        );
        const rateToInr = currencyData?.rate_to_inr || 1;
        const totalInr = parseFloat(total) * rateToInr;

        // Insert receipt
        const [result] = await connection.query(
            `INSERT INTO receipts (
                receipt_number, customer_id, currency, subtotal, coupon_code, discount, tax_rate,
                tax_amount, total, total_inr, payment_method, amount_paid, change_amount,
                cashier, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                receipt_number, customer_id || 1, currency, subtotal, coupon_code, discount, tax_rate,
                tax_amount, total, totalInr, payment_method, amount_paid, change_amount,
                cashier, notes
            ]
        );

        const receiptId = result.insertId;

        // Insert items
        if (items && items.length > 0) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO receipt_items (receipt_id, description, quantity, price, total)
                     VALUES (?, ?, ?, ?, ?)`,
                    [receiptId, item.description, item.quantity, item.price, item.quantity * item.price]
                );
            }
        }

        await connection.commit();
        res.status(201).json({
            id: receiptId,
            receipt_number,
            total_inr: totalInr,
            message: 'Receipt saved successfully'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating receipt:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Receipt number already exists' });
        }
        res.status(500).json({ error: 'Failed to create receipt' });
    } finally {
        connection.release();
    }
});

// ==================== DASHBOARD ROUTES ====================

// Get dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        // Total customers
        const [[{ total_customers }]] = await pool.query(
            'SELECT COUNT(*) as total_customers FROM customers WHERE id > 1'
        );

        // Total receipts
        const [[{ total_receipts }]] = await pool.query(
            'SELECT COUNT(*) as total_receipts FROM receipts'
        );

        // Total sales in INR
        const [[{ total_sales_inr }]] = await pool.query(
            'SELECT COALESCE(SUM(total_inr), 0) as total_sales_inr FROM receipts'
        );

        // Today's sales in INR
        const [[{ today_sales_inr }]] = await pool.query(
            `SELECT COALESCE(SUM(total_inr), 0) as today_sales_inr 
             FROM receipts 
             WHERE DATE(created_at) = CURDATE()`
        );

        // This week's sales in INR
        const [[{ week_sales_inr }]] = await pool.query(
            `SELECT COALESCE(SUM(total_inr), 0) as week_sales_inr 
             FROM receipts 
             WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)`
        );

        // This month's sales in INR
        const [[{ month_sales_inr }]] = await pool.query(
            `SELECT COALESCE(SUM(total_inr), 0) as month_sales_inr 
             FROM receipts 
             WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
        );

        // This year's sales in INR
        const [[{ year_sales_inr }]] = await pool.query(
            `SELECT COALESCE(SUM(total_inr), 0) as year_sales_inr 
             FROM receipts 
             WHERE YEAR(created_at) = YEAR(CURDATE())`
        );

        // Top customers by sales (in INR)
        const [top_customers] = await pool.query(
            `SELECT c.id, c.name, c.phone, c.email,
                    COUNT(r.id) as receipt_count,
                    COALESCE(SUM(r.total_inr), 0) as total_spent_inr
             FROM customers c
             INNER JOIN receipts r ON c.id = r.customer_id
             WHERE c.id > 1
             GROUP BY c.id
             ORDER BY total_spent_inr DESC
             LIMIT 10`
        );

        // Sales by payment method
        const [sales_by_payment] = await pool.query(
            `SELECT payment_method, 
                    COUNT(*) as count,
                    SUM(total_inr) as total_inr
             FROM receipts
             GROUP BY payment_method
             ORDER BY total_inr DESC`
        );

        // Sales by currency
        const [sales_by_currency] = await pool.query(
            `SELECT r.currency, cur.symbol, cur.name as currency_name,
                    COUNT(*) as count,
                    SUM(r.total) as total_original,
                    SUM(r.total_inr) as total_inr
             FROM receipts r
             LEFT JOIN currencies cur ON r.currency = cur.code
             GROUP BY r.currency
             ORDER BY total_inr DESC`
        );

        // Recent receipts
        const [recent_receipts] = await pool.query(
            `SELECT r.id, r.receipt_number, r.total, r.currency, r.total_inr, 
                    r.created_at, c.name as customer_name, cur.symbol
             FROM receipts r
             LEFT JOIN customers c ON r.customer_id = c.id
             LEFT JOIN currencies cur ON r.currency = cur.code
             ORDER BY r.created_at DESC
             LIMIT 10`
        );

        // Daily sales for last 7 days (in INR)
        const [daily_sales] = await pool.query(
            `SELECT DATE(created_at) as date,
                    COUNT(*) as receipt_count,
                    SUM(total_inr) as total_sales
             FROM receipts
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at)
             ORDER BY date`
        );

        // Weekly sales for last 12 weeks (in INR)
        const [weekly_sales] = await pool.query(
            `SELECT YEARWEEK(created_at, 1) as week,
                    MIN(DATE(created_at)) as week_start,
                    COUNT(*) as receipt_count,
                    SUM(total_inr) as total_sales
             FROM receipts
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
             GROUP BY YEARWEEK(created_at, 1)
             ORDER BY week`
        );

        // Monthly sales for last 12 months (in INR)
        const [monthly_sales] = await pool.query(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
                    MONTHNAME(created_at) as month_name,
                    COUNT(*) as receipt_count,
                    SUM(total_inr) as total_sales
             FROM receipts
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
             GROUP BY DATE_FORMAT(created_at, '%Y-%m'), MONTHNAME(created_at)
             ORDER BY month`
        );

        // Yearly sales (in INR)
        const [yearly_sales] = await pool.query(
            `SELECT YEAR(created_at) as year,
                    COUNT(*) as receipt_count,
                    SUM(total_inr) as total_sales
             FROM receipts
             GROUP BY YEAR(created_at)
             ORDER BY year`
        );

        res.json({
            total_customers,
            total_receipts,
            total_sales_inr: parseFloat(total_sales_inr) || 0,
            today_sales_inr: parseFloat(today_sales_inr) || 0,
            week_sales_inr: parseFloat(week_sales_inr) || 0,
            month_sales_inr: parseFloat(month_sales_inr) || 0,
            year_sales_inr: parseFloat(year_sales_inr) || 0,
            top_customers,
            sales_by_payment,
            sales_by_currency,
            recent_receipts,
            daily_sales,
            weekly_sales,
            monthly_sales,
            yearly_sales
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// ==================== CURRENCY ROUTES ====================

// Get all currencies
app.get('/api/currencies', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM currencies ORDER BY code');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching currencies:', error);
        res.status(500).json({ error: 'Failed to fetch currencies' });
    }
});

// ==================== PDF GENERATION ====================

// Generate PDF receipt
app.get('/api/receipts/:id/pdf', async (req, res) => {
    try {
        // Fetch business profile
        const [profiles] = await pool.query('SELECT * FROM business_profile LIMIT 1');
        const business = profiles[0] || { business_name: 'Business', address: '', phone: '', tax_id: '', footer_message: '' };

        // Fetch receipt data
        const [receipts] = await pool.query(
            `SELECT r.*, c.name as customer_name, c.phone as customer_phone, 
                    c.email as customer_email, cur.symbol as currency_symbol
             FROM receipts r
             LEFT JOIN customers c ON r.customer_id = c.id
             LEFT JOIN currencies cur ON r.currency = cur.code
             WHERE r.id = ?`,
            [req.params.id]
        );

        if (receipts.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        const receipt = receipts[0];
        const [items] = await pool.query(
            'SELECT * FROM receipt_items WHERE receipt_id = ?',
            [req.params.id]
        );

        // Create PDF with receipt paper size (80mm width)
        const doc = new PDFDocument({
            size: [226.77, 600], // 80mm width, variable height
            margin: 20
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=receipt-${receipt.receipt_number}.pdf`);

        doc.pipe(res);

        const symbol = receipt.currency_symbol || '₹';
        const centerX = 113;

        // Business Header (from profile)
        doc.font('Courier-Bold').fontSize(14)
            .text(business.business_name || 'BUSINESS', { align: 'center' });

        doc.font('Courier').fontSize(8)
            .text(business.address || '', { align: 'center' })
            .text(`Tel: ${business.phone || ''}`, { align: 'center' });

        if (business.tax_id) {
            doc.text(`GST: ${business.tax_id}`, { align: 'center' });
        }

        doc.moveDown(0.5);
        doc.text('================================', { align: 'center' });

        // Receipt Info
        doc.moveDown(0.3);
        doc.text(`Receipt #: ${receipt.receipt_number}`, 20);
        doc.text(`Date: ${new Date(receipt.created_at).toLocaleDateString('en-GB')}`, 20);
        doc.text(`Time: ${new Date(receipt.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, 20);
        doc.text(`Cashier: ${receipt.cashier || '-'}`, 20);

        if (receipt.customer_name && receipt.customer_name !== 'Walk-in Customer') {
            doc.text(`Customer: ${receipt.customer_name}`, 20);
        }

        doc.moveDown(0.3);
        doc.text('================================', { align: 'center' });

        // Items Header
        doc.moveDown(0.3);
        doc.font('Courier-Bold').fontSize(8);
        doc.text('ITEM', 20, doc.y, { continued: false });

        doc.moveDown(0.3);
        doc.font('Courier').fontSize(8);

        // Items
        items.forEach(item => {
            const itemTotal = parseFloat(item.total) || 0;
            doc.text(`${item.description}`, 20);
            doc.text(`  ${item.quantity} x ${symbol}${parseFloat(item.price).toFixed(2)}`, 20, doc.y, { continued: true });
            doc.text(`${symbol}${itemTotal.toFixed(2)}`, { align: 'right' });
        });

        doc.moveDown(0.3);
        doc.text('================================', { align: 'center' });

        // Totals
        doc.moveDown(0.3);
        const subtotal = parseFloat(receipt.subtotal) || 0;
        const discount = parseFloat(receipt.discount) || 0;
        const taxAmount = parseFloat(receipt.tax_amount) || 0;
        const total = parseFloat(receipt.total) || 0;
        const amountPaid = parseFloat(receipt.amount_paid) || 0;
        const change = parseFloat(receipt.change_amount) || 0;

        doc.text(`Subtotal:`, 20, doc.y, { continued: true });
        doc.text(`${symbol}${subtotal.toFixed(2)}`, { align: 'right' });

        if (discount > 0) {
            const label = receipt.coupon_code ? `Discount (${receipt.coupon_code}):` : `Discount:`;
            doc.text(label, 20, doc.y, { continued: true });
            doc.text(`-${symbol}${discount.toFixed(2)}`, { align: 'right' });
        }

        doc.text(`Tax (${receipt.tax_rate}%):`, 20, doc.y, { continued: true });
        doc.text(`${symbol}${taxAmount.toFixed(2)}`, { align: 'right' });

        doc.text('--------------------------------', { align: 'center' });

        doc.font('Courier-Bold').fontSize(10);
        doc.text(`TOTAL:`, 20, doc.y, { continued: true });
        doc.text(`${symbol}${total.toFixed(2)}`, { align: 'right' });

        doc.font('Courier').fontSize(8);
        doc.moveDown(0.3);
        doc.text('================================', { align: 'center' });

        // Payment
        doc.moveDown(0.3);
        doc.text(`Payment: ${receipt.payment_method}`, 20);
        doc.text(`Paid:`, 20, doc.y, { continued: true });
        doc.text(`${symbol}${amountPaid.toFixed(2)}`, { align: 'right' });
        doc.text(`Change:`, 20, doc.y, { continued: true });
        doc.text(`${symbol}${change.toFixed(2)}`, { align: 'right' });

        // INR Equivalent (if different currency)
        if (receipt.currency !== 'INR') {
            doc.moveDown(0.3);
            doc.text(`(INR Equivalent: ₹${parseFloat(receipt.total_inr).toFixed(2)})`, { align: 'center' });
        }

        doc.moveDown(0.3);
        doc.text('================================', { align: 'center' });

        // Footer (from business profile)
        if (business.footer_message) {
            doc.moveDown(0.3);
            const footerLines = business.footer_message.split('\n');
            footerLines.forEach(line => {
                doc.text(line, { align: 'center' });
            });
        }

        // Barcode placeholder
        doc.moveDown(0.5);
        doc.text(`*${receipt.receipt_number}*`, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Search customers
app.get('/api/search/customers', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }
        const [rows] = await pool.query(
            `SELECT id, name, phone, email 
             FROM customers 
             WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
             LIMIT 10`,
            [`%${q}%`, `%${q}%`, `%${q}%`]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error searching customers:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

app.get('/coupons', (req, res) => {
    res.sendFile(path.join(__dirname, 'coupons.html'));
});

// ==================== COUPON ROUTES ====================

// Get all coupons
app.get('/api/coupons', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM coupons WHERE active = 1 ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch coupons' });
    }
});

// Create coupon
app.post('/api/coupons', async (req, res) => {
    try {
        const { code, discount_type, discount_value, min_purchase } = req.body;
        await pool.query(
            'INSERT INTO coupons (code, discount_type, discount_value, min_purchase) VALUES (?, ?, ?, ?)',
            [code, discount_type, discount_value, min_purchase || 0]
        );
        res.status(201).json({ message: 'Coupon created' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Coupon code already exists' });
        }
        res.status(500).json({ error: 'Failed to create coupon' });
    }
});

// Delete coupon
app.delete('/api/coupons/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
        res.json({ message: 'Coupon deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete coupon' });
    }
});

// Validate coupon
app.post('/api/coupons/validate', async (req, res) => {
    try {
        const { code, amount } = req.body;
        const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ? AND active = 1', [code]);

        if (rows.length === 0) {
            return res.status(404).json({ valid: false, message: 'Invalid coupon code' });
        }

        const coupon = rows[0];
        if (parseFloat(amount) < parseFloat(coupon.min_purchase)) {
            return res.status(400).json({ valid: false, message: `Minimum purchase of ${coupon.min_purchase} required` });
        }

        let discount = 0;
        if (coupon.discount_type === 'PERCENTAGE') {
            discount = (parseFloat(amount) * parseFloat(coupon.discount_value)) / 100;
        } else {
            discount = parseFloat(coupon.discount_value);
        }

        res.json({
            valid: true,
            code: coupon.code,
            discount: parseFloat(discount.toFixed(2)),
            type: coupon.discount_type,
            value: coupon.discount_value
        });
    } catch (error) {
        res.status(500).json({ error: 'Validation failed' });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`\n🧾 Receipt Generator Server`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`→ Server running on http://localhost:${PORT}`);
    console.log(`→ Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    await testConnection();
});

