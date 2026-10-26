-- Register used to be always on, and Inventory now starts on. Lists saved before that omit both paths.
UPDATE "User"
SET "cashierPages" = json_insert("cashierPages", '$[#]', '/orders')
WHERE role = 'CASHIER'
  AND "cashierPages" IS NOT NULL
  AND instr("cashierPages", '/orders') = 0;

UPDATE "User"
SET "cashierPages" = json_insert("cashierPages", '$[#]', '/inventory')
WHERE role = 'CASHIER'
  AND "cashierPages" IS NOT NULL
  AND instr("cashierPages", '/inventory') = 0;
