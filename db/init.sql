-- Receipt Generator Database Schema

-- Business Profile table (stores your business information)
CREATE TABLE IF NOT EXISTS business_profile (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL DEFAULT 'My Business',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    tax_id VARCHAR(100),
    website VARCHAR(255),
    cashier_name VARCHAR(100),
    footer_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default business profile
INSERT INTO business_profile (business_name, address, phone, tax_id, cashier_name, footer_message) VALUES
('My Business', '123 Main Street, City, State 12345', '(555) 123-4567', 'GST123456789', 'Staff', 'Thank you for your purchase!\nPlease visit again.');

-- Currencies table with INR conversion rates
CREATE TABLE IF NOT EXISTS currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    rate_to_inr DECIMAL(12,4) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert common currencies with approximate INR rates
INSERT INTO currencies (code, name, symbol, rate_to_inr) VALUES
('INR', 'Indian Rupee', '₹', 1.0000),
('USD', 'US Dollar', '$', 83.1200),
('EUR', 'Euro', '€', 90.2500),
('GBP', 'British Pound', '£', 105.4500),
('AED', 'UAE Dirham', 'د.إ', 22.6300),
('SAR', 'Saudi Riyal', '﷼', 22.1600),
('JPY', 'Japanese Yen', '¥', 0.5580),
('AUD', 'Australian Dollar', 'A$', 54.8900),
('CAD', 'Canadian Dollar', 'C$', 61.2500),
('SGD', 'Singapore Dollar', 'S$', 62.1500);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_phone (phone)
);

-- Insert a default "Walk-in Customer" for anonymous sales
INSERT INTO customers (name, phone, email, address) 
VALUES ('Walk-in Customer', '', '', '');

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_purchase DECIMAL(10,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a sample coupon
INSERT INTO coupons (code, discount_type, discount_value, min_purchase) VALUES 
('WELCOME10', 'PERCENTAGE', 10.00, 0),
('SAVE50', 'FIXED', 50.00, 500);

-- Receipts table (simplified - business info fetched from profile)
CREATE TABLE IF NOT EXISTS receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT,
    currency VARCHAR(3) DEFAULT 'INR',
    subtotal DECIMAL(10,2) DEFAULT 0,
    coupon_code VARCHAR(50),
    discount DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    total_inr DECIMAL(12,2) DEFAULT 0,
    payment_method VARCHAR(50),
    amount_paid DECIMAL(10,2) DEFAULT 0,
    change_amount DECIMAL(10,2) DEFAULT 0,
    cashier VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (currency) REFERENCES currencies(code),
    INDEX idx_receipt_number (receipt_number),
    INDEX idx_customer_id (customer_id),
    INDEX idx_created_at (created_at),
    INDEX idx_currency (currency)
);

-- Receipt items table
CREATE TABLE IF NOT EXISTS receipt_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_id INT NOT NULL,
    description VARCHAR(255),
    quantity INT DEFAULT 1,
    price DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
    INDEX idx_receipt_id (receipt_id)
);
