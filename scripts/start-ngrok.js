const ngrok = require('ngrok');

(async function () {
  const url = await ngrok.connect(8545); 
  console.log(`Ngrok Tunnel Started: ${url}`);
})();