-- Delivery3D — normalized schema (1NF-4NF/BCNF), MySQL 8.0 / InnoDB, utf8mb4/utf8mb4_unicode_ci
-- Reference design artifact (see openspec/project.md + openspec/changes/*/design.md for the
-- change packages this schema will be reconciled into).

SET NAMES utf8mb4;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(80) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    origin ENUM('whatsapp', 'instagram_dm', 'otro') NOT NULL,
    phone VARCHAR(40) NULL,
    instagram_username VARCHAR(80) NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ix_clients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    brand VARCHAR(80) NOT NULL,
    type ENUM('PLA', 'PETG', 'ABS', 'TPU', 'otro') NOT NULL,
    color VARCHAR(60) NOT NULL,
    cost_per_kg DECIMAL(10, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_materials_cost_per_kg CHECK (cost_per_kg >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('nuevo', 'presupuestado', 'aprobado', 'imprimiendo', 'listo', 'entregado', 'cancelado')
        NOT NULL DEFAULT 'nuevo',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_client FOREIGN KEY (client_id) REFERENCES clients(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX ix_orders_status_created_at (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Resolves the 4NF concern: pieces and materials are independent multivalued facts
-- about an order unless tied together per line item.
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    material_id INT NOT NULL,
    piece_description TEXT NOT NULL,
    reference_url VARCHAR(500) NULL,
    weight_g DECIMAL(10, 3) NOT NULL,
    print_time_minutes INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_material FOREIGN KEY (material_id) REFERENCES materials(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_order_items_weight CHECK (weight_g > 0),
    CONSTRAINT chk_order_items_time CHECK (print_time_minutes > 0),
    CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
    INDEX ix_order_items_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3FN: only the workshop cost PARAMETERS and the operator's final informed price are
-- stored. production_cost / suggested_sale_price are NOT columns — they are derived
-- (transitively, from order_items + these parameters) and computed on read.
CREATE TABLE order_quotes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    kwh_cost DECIMAL(8, 2) NOT NULL,
    machine_power_watts DECIMAL(6, 2) NOT NULL,
    machine_cost_per_hour DECIMAL(8, 2) NOT NULL,
    waste_purge_pct DECIMAL(5, 2) NOT NULL,
    profit_margin_pct DECIMAL(5, 2) NOT NULL,
    informed_price DECIMAL(10, 2) NULL,
    quoted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_quotes_order FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_order_quotes_order UNIQUE (order_id),
    CONSTRAINT chk_order_quotes_informed_price CHECK (informed_price IS NULL OR informed_price > 0),
    CONSTRAINT chk_order_quotes_pct CHECK (waste_purge_pct >= 0 AND profit_margin_pct >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kept from the traceability requirement in Project.md §1 (not in the requested entity
-- list, but required by openspec/project.md's "trazabilidad completa" constraint).
CREATE TABLE order_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    from_status ENUM('nuevo', 'presupuestado', 'aprobado', 'imprimiendo', 'listo', 'entregado', 'cancelado') NULL,
    to_status ENUM('nuevo', 'presupuestado', 'aprobado', 'imprimiendo', 'listo', 'entregado', 'cancelado') NOT NULL,
    changed_by INT NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_osh_user FOREIGN KEY (changed_by) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX ix_osh_order_id_changed_at (order_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cash_movements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('ingreso', 'egreso') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(60) NOT NULL,
    order_id INT NULL,
    user_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cash_movements_order FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_cash_movements_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_cash_movements_amount CHECK (amount > 0),
    INDEX ix_cash_movements_order_id (order_id),
    INDEX ix_cash_movements_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
