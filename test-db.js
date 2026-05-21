const { db, dbPath } = require('./src/config/database');

const tables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

console.log('Base Livoo:', dbPath);

for (const { name } of tables) {
  const safeName = name.replaceAll('"', '""');
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM "${safeName}"`).get();
  console.log(`${name}: ${count}`);
}
