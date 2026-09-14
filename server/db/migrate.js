const mysqlClient = require('./mysql.client');

async function migrate() {
  console.log('🔄 Running Antigravity Database Migration...');
  const connected = await mysqlClient.init();
  if (connected) {
    await mysqlClient.runMigrations();
    console.log('🎉 Migration completed successfully!');
  } else {
    console.log('⚠️ Could not connect to MySQL server. Please verify your connection settings in .env.');
  }
  await mysqlClient.close();
  process.exit(connected ? 0 : 1);
}

migrate();
