const fs = require('fs');
fs.writeFileSync('.env.railway', 
  'NEXT_PUBLIC_SUPABASE_URL=https://jjzwqkmefahkcacqjluf.supabase.co\n' +
  'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqendxa21lZmFoa2NhY3FqbHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODQxMjYsImV4cCI6MjA4OTk2MDEyNn0.b1iyQyJAFFS4khjYD9x0zujnrZyFMHRaMIO7wJbuCfI\n'
);
console.log('env file written');
