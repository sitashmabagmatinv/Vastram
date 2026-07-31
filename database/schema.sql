CREATE DATABASE IF NOT EXISTS vastram CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vastram;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'customer') NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_users_role (role)
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  full_name VARCHAR(140) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(160) NULL,
  address VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customers_name (full_name),
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS measurements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  label VARCHAR(100) NOT NULL DEFAULT 'Standard profile',
  bust DECIMAL(6,2) NULL,
  waist DECIMAL(6,2) NULL,
  hips DECIMAL(6,2) NULL,
  shoulder DECIMAL(6,2) NULL,
  sleeve DECIMAL(6,2) NULL,
  length DECIMAL(6,2) NULL,
  neck DECIMAL(6,2) NULL,
  inseam DECIMAL(6,2) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_measurements_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_measurements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_measurements_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fabrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  fabric_type VARCHAR(100) NOT NULL,
  color VARCHAR(80) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'meters',
  stock_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(10,2) NOT NULL DEFAULT 5,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_fabrics_stock (stock_quantity, low_stock_threshold)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fabric_id INT NOT NULL,
  movement_type ENUM('add', 'deduct', 'adjust') NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  note VARCHAR(255) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movements_fabric FOREIGN KEY (fabric_id) REFERENCES fabrics(id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ready_made_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  category VARCHAR(100) NOT NULL,
  size VARCHAR(40) NOT NULL,
  color VARCHAR(80) NOT NULL,
  price DECIMAL(10,2) NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  description TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ready_made_available (active, stock_quantity)
);

CREATE TABLE IF NOT EXISTS ready_made_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  customer_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  status ENUM('requested', 'confirmed', 'ready_for_pickup', 'completed', 'cancelled') NOT NULL DEFAULT 'requested',
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ready_made_orders_customer (customer_id),
  KEY idx_ready_made_orders_status (status),
  CONSTRAINT fk_ready_orders_item FOREIGN KEY (item_id) REFERENCES ready_made_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ready_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(40) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  assigned_staff_id INT NULL,
  measurement_id INT NULL,
  primary_fabric_id INT NULL,
  garment_type VARCHAR(120) NOT NULL,
  due_date DATE NULL,
  status ENUM('received', 'fabric_selected', 'cutting', 'stitching', 'finishing', 'quality_check', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'received',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_status (status),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_staff (assigned_staff_id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_measurement FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_fabric FOREIGN KEY (primary_fabric_id) REFERENCES fabrics(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status ENUM('received', 'fabric_selected', 'cutting', 'stitching', 'finishing', 'quality_check', 'ready', 'completed', 'cancelled') NOT NULL,
  note VARCHAR(255) NULL,
  changed_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_status_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_status_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);
