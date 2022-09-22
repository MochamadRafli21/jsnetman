const express = require('express');
const network = require("node-network-manager");
const { exec } = require('child_process');
const wifi = require('node-wifi');
const bodyParser = require('body-parser');

const jsonParser = bodyParser.json()

wifi.init({
    iface: null // network interface, choose a random wifi interface if set to null
  });


const app = express()

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
        .getConnectionProfilesList()
        .then((data) => console.log(data))
        .catch((error) => console.log(error));
      await network
        .getDeviceInfoIPDetail(ethernet.DEVICE)
        .then((data) => networks.push(data))
        .catch((error) => console.log(error));
      await network
        .getDeviceInfoIPDetail(device.DEVICE)
        .then((data) => networks.push(data))
        .catch((error) => console.log(error));
    })
    exec(`nmap ${networks[0].gatewayV4}`, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          return;
        }
        if(stdout){
            networks[0].nmap = stdout
        }

        res.json(networks)
      });
});

app.post('/networks/connect',jsonParser, async(req,res) => {
    const ssid = req.body.ssid
    const password = req.body.password
    await wifi.connect({ ssid: ssid, password: password });
      
    const networks = []
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

    exec(`nmap ${networks[0].gatewayV4}`, (err, stdout, stderr) => {
        if (err) {
          console.error(err);
          return;
        }
        if(stdout){
            networks[0].nmap = stdout
        }

        res.json(networks)
      });
});

app.post('')
const server = app.listen(3000)