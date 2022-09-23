const express = require('express');
const network = require("node-network-manager");
const {spawnSync} = require('child_process');
const wifi = require('node-wifi');
const bodyParser = require('body-parser');
const path = require( 'path' );
const jsonParser = bodyParser.json()

wifi.init({
    iface: null // network interface, choose a random wifi interface if set to null
  });


const app = express()

// endpoint untuk redirect ke view list wifi
app.get('/', async(req, res) => {
  res.sendFile(path.join(__dirname+'/views/index.html'));
})

app.get('/networks',jsonParser, async(req,res) =>{
    const networks = await wifi.scan()
    res.json(networks)
});

app.get('/networks/connect',jsonParser, async(req,res) => {
    let networks = []
    // TODO GET LOSS PACKAGE USING PING!!
    await network
    .getConnectionProfilesList(false)
    .then(async (data) => {
      const ethernet = data.find((item) => item.TYPE === "ethernet");
      const device = data.find((item) => item.TYPE === "wifi");
      await network
        .getDeviceInfoIPDetail(ethernet.DEVICE)
        .then((data) => networks.push(data))
        .catch((error) => console.log(error));
      await network
        .getDeviceInfoIPDetail(device.DEVICE)
        .then((data) => networks.push(data))
        .catch((error) => console.log(error));
    })
    if(networks.length >= 1){
      const nmap = spawnSync('nmap',[networks[0].gatewayV4])
      let dataNmap = nmap.stdout.toString().trim()
      networks[0].nmap = dataNmap.split('\n')
  
      const loss = spawnSync('ping',['-c5',networks[0].gatewayV4])
      let dataLoss = loss.stdout.toString().trim()
      dataLoss = dataLoss.split('\n')[8].split(',')[2]
      networks[0].loss = dataLoss
    }

    res.json(networks)

});

app.delete('/networks/connect',jsonParser,(req,res) => {
  const ssid = req.body.ssid
  if(!ssid){
    throw new Error('ssid is required')
  }
  const result = spawnSync('nmcli',["con", "down", "id", ssid])
  res.json(result)

})

app.post('/networks/connect',jsonParser, async(req,res) => {
    const ssid = req.body.ssid
    const password = req.body.password
    try{
      await wifi.connect({ ssid: ssid, password: password });
    }catch(e){
      console.log(e)
    }
    res.json({status:"success"})
      
});

app.post('')
const server = app.listen(3000)