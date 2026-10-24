const fs = require('fs')
fs.writeFileSync(__dirname + '/probe.log', JSON.stringify(process.argv) + '\n')
const { app } = require('electron')
app.whenReady().then(() => { fs.appendFileSync(__dirname + '/probe.log', 'ready\n'); app.quit() })
