// Explicit upsert/restore of only the canonical fictional cases. Requires built API and DATABASE_URL.
const { initializeDatabase, flushDatabase, disconnectDatabase } = require('../dist/src/persistence');
const { seedCompetitionDemo } = require('../dist/src/services/competition.service');
(async()=>{try{await initializeDatabase();const result=seedCompetitionDemo();await flushDatabase();console.log(JSON.stringify(result));}finally{await disconnectDatabase();}})().catch(()=>{console.error('Demo seed failed. Check database connectivity and record collisions.');process.exitCode=1;});
